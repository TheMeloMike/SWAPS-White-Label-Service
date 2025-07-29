package com.swaps.spark

import org.apache.spark.sql.{SparkSession, DataFrame}
import org.apache.spark.sql.functions._
import org.apache.spark.graphx._
import org.apache.spark.rdd.RDD
import org.apache.spark.storage.StorageLevel

/**
 * Apache Spark GraphX implementation for finding trade loops in extremely large NFT networks.
 * This can scale to millions of wallets and NFTs by leveraging distributed computing.
 */
object TradeLoopSpark {
  def main(args: Array[String]): Unit = {
    // Create Spark session
    val spark = SparkSession.builder()
      .appName("SWAPS Trade Loop Finder")
      .config("spark.master", "local[*]") // Use all cores - for cluster deployment change to yarn or k8s
      .getOrCreate()
    
    import spark.implicits._
    
    // Parse command line arguments
    val walletPath = args(0) // Path to wallet data
    val nftOwnershipPath = args(1) // Path to NFT ownership data
    val wantedNftsPath = args(2) // Path to wanted NFTs data
    val outputPath = args(3) // Path to save results
    
    // Load wallet data (schema: wallet_address, owned_nfts, wanted_nfts)
    val walletsDf = spark.read.parquet(walletPath)
    
    // Load NFT ownership data (schema: nft_address, owner_address)
    val nftOwnershipDf = spark.read.parquet(nftOwnershipPath)
    
    // Load wanted NFTs data (schema: nft_address, wallet_address)
    val wantedNftsDf = spark.read.parquet(wantedNftsPath)
    
    // Build the graph
    val (graph, idToWallet) = buildGraph(spark, nftOwnershipDf, wantedNftsDf)
    
    // Cache the graph for better performance
    graph.persist(StorageLevel.MEMORY_AND_DISK)
    
    // Find strongly connected components
    val sccGraph = graph.stronglyConnectedComponents(maxIterations = 20)
    
    // Get SCCs with their sizes - useful for partitioning workload
    val sccSizes = sccGraph.vertices
      .map { case (id, sccId) => (sccId, 1L) }
      .reduceByKey(_ + _)
      .collect()
      .sortBy(-_._2)
    
    println(s"Found ${sccSizes.length} strongly connected components")
    println("Top 10 SCCs by size:")
    sccSizes.take(10).foreach { case (sccId, size) => 
      println(s"SCC ID $sccId: $size vertices")
    }
    
    // Extract SCCs for trade loop finding - focus on reasonable sized SCCs
    val reasonableSizedSccIds = sccSizes
      .filter { case (_, size) => size >= 3 && size <= 100 } // Filter out too small or too large SCCs
      .map(_._1)
      .toSet
    
    println(s"Processing ${reasonableSizedSccIds.size} reasonably sized SCCs")
    
    // For each SCC, find cycles using GraphX's built-in algorithms adapted for our use case
    val allTradeLoops = findTradeLoopsInComponents(graph, sccGraph, reasonableSizedSccIds, idToWallet)
    
    // Convert results to DataFrame
    val tradeLoopsDF = createTradeLoopsDataFrame(spark, allTradeLoops)
    
    // Save results
    tradeLoopsDF.write.parquet(outputPath)
    
    println(s"Found ${allTradeLoops.size} potential trade loops")
    println(s"Results saved to $outputPath")
    
    // Cleanup
    spark.stop()
  }
  
  /**
   * Build a GraphX graph from the NFT ownership and wanted NFTs data
   */
  def buildGraph(
    spark: SparkSession,
    nftOwnershipDf: DataFrame,
    wantedNftsDf: DataFrame
  ): (Graph[String, String], Map[VertexId, String]) = {
    // Join the datasets to create edges
    val edgesDf = nftOwnershipDf.as("ownership")
      .join(wantedNftsDf.as("wanted"), $"ownership.nft_address" === $"wanted.nft_address")
      .select(
        $"ownership.owner_address".as("src"),
        $"wanted.wallet_address".as("dst"),
        $"ownership.nft_address".as("nft")
      )
      .filter($"src" =!= $"dst") // Remove self-loops
    
    // Get all unique wallets for vertices
    val allWallets = edgesDf.select($"src").union(edgesDf.select($"dst")).distinct()
    
    // Create vertex RDD with indices
    val wallets = allWallets.rdd.zipWithIndex()
      .map { case (row, id) => (id, row.getString(0)) }
    
    // Create wallet ID lookup maps
    val walletToId = wallets.map { case (id, wallet) => (wallet, id) }.collect().toMap
    val idToWallet = wallets.map { case (id, wallet) => (id, wallet) }.collect().toMap
    
    // Create edge RDD with wallet IDs
    val edges = edgesDf.rdd.map { row =>
      val src = row.getString(0)
      val dst = row.getString(1)
      val nft = row.getString(2)
      
      Edge(walletToId(src), walletToId(dst), nft)
    }
    
    // Create the graph
    val graph = Graph(
      vertices = spark.sparkContext.parallelize(walletToId.map { case (wallet, id) => (id, wallet) }.toSeq),
      edges = edges
    )
    
    (graph, idToWallet)
  }
  
  /**
   * Find trade loops in the selected components
   */
  def findTradeLoopsInComponents(
    graph: Graph[String, String],
    sccGraph: Graph[VertexId, String],
    sccIds: Set[VertexId],
    idToWallet: Map[VertexId, String]
  ): Seq[TradeLoop] = {
    // Collect all trade loops
    var allTradeLoops = Seq.empty[TradeLoop]
    
    // Process each SCC
    for (sccId <- sccIds) {
      println(s"Processing SCC $sccId")
      
      // Get vertices in this SCC
      val sccVertices = sccGraph.vertices
        .filter { case (_, componentId) => componentId == sccId }
        .map(_._1)
        .collect()
        .toSet
      
      // Extract the subgraph for this SCC
      val subgraph = graph.subgraph(
        vpred = (id, _) => sccVertices.contains(id),
        epred = e => sccVertices.contains(e.srcId) && sccVertices.contains(e.dstId)
      )
      
      // Find cycles in this component using our adapted Johnson's algorithm
      val cycles = findElementaryCycles(subgraph, sccVertices)
      
      // Convert cycles to trade loops
      val tradeLoops = cycles.map { cycle =>
        val steps = (0 until cycle.length).map { i =>
          val currentId = cycle(i)
          val nextId = cycle((i + 1) % cycle.length)
          
          // Get the NFT address from the edge
          val nftAddress = graph.edges
            .filter(e => e.srcId == currentId && e.dstId == nextId)
            .map(_.attr)
            .first()
          
          TradeStep(
            from = idToWallet(currentId),
            to = idToWallet(nextId),
            nft = nftAddress
          )
        }
        
        TradeLoop(
          id = s"spark-${System.currentTimeMillis()}-${allTradeLoops.size}",
          steps = steps.toArray,
          participants = steps.map(_.from).toSet.size,
          efficiency = 1.0 // Default efficiency - can be calculated later
        )
      }
      
      allTradeLoops = allTradeLoops ++ tradeLoops
    }
    
    allTradeLoops
  }
  
  /**
   * Find elementary cycles in a graph using an adaptation of Johnson's algorithm
   * This is a simplified implementation for Spark
   */
  def findElementaryCycles(
    graph: Graph[String, String],
    vertices: Set[VertexId],
    maxDepth: Int = 10,
    maxCycles: Int = 1000
  ): Seq[Array[VertexId]] = {
    var allCycles = Seq.empty[Array[VertexId]]
    var remainingVertices = vertices.toSeq
    
    // Process each vertex as a potential starting point
    for (startVertex <- remainingVertices if allCycles.size < maxCycles) {
      val visited = collection.mutable.Set.empty[VertexId]
      val path = collection.mutable.ArrayBuffer.empty[VertexId]
      
      // Run DFS from this vertex
      findCyclesDFS(
        graph,
        startVertex,
        startVertex,
        path,
        visited,
        allCycles,
        0,
        maxDepth,
        maxCycles
      )
      
      // Remove this vertex from further consideration
      remainingVertices = remainingVertices.filter(_ != startVertex)
    }
    
    allCycles
  }
  
  /**
   * DFS helper for finding cycles
   */
  def findCyclesDFS(
    graph: Graph[String, String],
    startVertex: VertexId,
    currentVertex: VertexId,
    path: collection.mutable.ArrayBuffer[VertexId],
    visited: collection.mutable.Set[VertexId],
    cycles: collection.mutable.Seq[Array[VertexId]],
    depth: Int,
    maxDepth: Int,
    maxCycles: Int
  ): Unit = {
    // Check termination conditions
    if (depth >= maxDepth || cycles.size >= maxCycles) {
      return
    }
    
    // Add current vertex to path and mark as visited
    path += currentVertex
    visited += currentVertex
    
    // Get outgoing edges for this vertex
    val outEdges = graph.edges
      .filter(_.srcId == currentVertex)
      .collect()
    
    // Check each neighbor
    for (edge <- outEdges if cycles.size < maxCycles) {
      val neighbor = edge.dstId
      
      // If we found a cycle back to start
      if (neighbor == startVertex && path.length > 2) {
        // Add cycle to results
        cycles :+= path.toArray
      } 
      // Otherwise continue DFS if not visited
      else if (!visited.contains(neighbor)) {
        findCyclesDFS(
          graph,
          startVertex,
          neighbor,
          path,
          visited,
          cycles,
          depth + 1,
          maxDepth,
          maxCycles
        )
      }
    }
    
    // Backtrack
    path.remove(path.length - 1)
    visited -= currentVertex
  }
  
  /**
   * Convert trade loops to a DataFrame
   */
  def createTradeLoopsDataFrame(
    spark: SparkSession,
    tradeLoops: Seq[TradeLoop]
  ): DataFrame = {
    import spark.implicits._
    
    // Create rows for each trade loop
    val rows = tradeLoops.map { loop =>
      (
        loop.id,
        loop.steps.map(_.from).mkString(","),
        loop.steps.map(_.to).mkString(","),
        loop.steps.map(_.nft).mkString(","),
        loop.participants,
        loop.efficiency,
        System.currentTimeMillis()
      )
    }
    
    // Create DataFrame
    spark.createDataFrame(rows).toDF(
      "id",
      "from_wallets",
      "to_wallets",
      "nft_addresses",
      "participants",
      "efficiency",
      "timestamp"
    )
  }
  
  // Case classes for representing trade data
  case class TradeStep(from: String, to: String, nft: String)
  
  case class TradeLoop(
    id: String,
    steps: Array[TradeStep],
    participants: Int,
    efficiency: Double
  )
} 
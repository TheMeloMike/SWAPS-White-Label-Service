name := "swaps-spark"
version := "1.0.0"
scalaVersion := "2.12.15"

// Spark dependencies
libraryDependencies ++= Seq(
  "org.apache.spark" %% "spark-core" % "3.3.2" % "provided",
  "org.apache.spark" %% "spark-sql" % "3.3.2" % "provided",
  "org.apache.spark" %% "spark-graphx" % "3.3.2" % "provided"
)

// Assembly configuration
assembly / assemblyJarName := "swaps-spark-assembly.jar"

// Merge strategy
assembly / assemblyMergeStrategy := {
  case PathList("META-INF", xs @ _*) => MergeStrategy.discard
  case x => MergeStrategy.first
}

// Compiler options
scalacOptions ++= Seq(
  "-deprecation",
  "-feature",
  "-unchecked",
  "-Xlint"
) 
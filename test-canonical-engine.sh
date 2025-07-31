#!/bin/bash
# Test script for canonical engine validation
echo "🧪 TESTING CANONICAL ENGINE PERFORMANCE"
echo "========================================"

echo "📊 Testing with 3-wallet, 9-NFT circular trade scenario..."
echo "Expected: 3 unique logical trades (one per collection)"
echo "Legacy would show: 18+ duplicated permutations"
echo ""

curl -X POST "https://swaps-93hu.onrender.com/api/v1/discovery/trades" \
  -H "Authorization: Bearer swaps_3ec3201bb34b82baa94d094fd217e305022342810c7ff3fa93b36f49b07dc5b7" \
  -H "Content-Type: application/json" \
  -d '{
    "wallets": [
      {
        "id": "5pPCbuGso6NguFBWAqaKm7FW9msRoLQQoWu7kawGfFna",
        "ownedNFTs": [
          {
            "id": "DGPXMa22xFTs6N9fiCxozJnCCEFuDA4sE555JdtckBRH",
            "metadata": { "name": "Fly Guys #843 GREEN" },
            "ownership": { "ownerId": "5pPCbuGso6NguFBWAqaKm7FW9msRoLQQoWu7kawGfFna" }
          },
          {
            "id": "H7uQWdfARF18mi5uFCuZtWu7it4dsQetNX754igrPYcc",
            "metadata": { "name": "KING #467 WHITE" },
            "ownership": { "ownerId": "5pPCbuGso6NguFBWAqaKm7FW9msRoLQQoWu7kawGfFna" }
          },
          {
            "id": "CaE8oUsYRCvRByMYBRrg7vjaaSa4fbHSwXKEdBj8EKNf",
            "metadata": { "name": "GhostKid #4402 WHITE" },
            "ownership": { "ownerId": "5pPCbuGso6NguFBWAqaKm7FW9msRoLQQoWu7kawGfFna" }
          }
        ],
        "wantedNFTs": ["4iCQftmw9EouFsDQabdqEzc6tysSMagyNSWrHusWibAk", "CQCrLu5AQ15zSBGyNodWYxXxBfYHibMN29DR1jPXaFHx", "ABiGDshndLxs935LEyx5YJ6SrkeMLEBwCmtDtfFcck1W"]
      },
      {
        "id": "NHLeTzVE1BriRr3Uuebyq1aKEjRvWFMozy2BDAuLN2m",
        "ownedNFTs": [
          {
            "id": "4iCQftmw9EouFsDQabdqEzc6tysSMagyNSWrHusWibAk",
            "metadata": { "name": "Fly Guys #157 ORANGE" },
            "ownership": { "ownerId": "NHLeTzVE1BriRr3Uuebyq1aKEjRvWFMozy2BDAuLN2m" }
          },
          {
            "id": "HtyJpWfdLWDRf87LQTjMHxwdcraSAATfEwwZmcmfiihR",
            "metadata": { "name": "KING #6460 BRICK" },
            "ownership": { "ownerId": "NHLeTzVE1BriRr3Uuebyq1aKEjRvWFMozy2BDAuLN2m" }
          },
          {
            "id": "G7yWHtUEfZgocWwzwChPMXnP91HUXJ2V2GnqUiovkHgs",
            "metadata": { "name": "GhostKid #4324 GREEN" },
            "ownership": { "ownerId": "NHLeTzVE1BriRr3Uuebyq1aKEjRvWFMozy2BDAuLN2m" }
          }
        ],
        "wantedNFTs": ["6K87VYDnPrhefPjBnEdi9hUfC9fr3W8qDbGnMKnyoGvP", "H7uQWdfARF18mi5uFCuZtWu7it4dsQetNX754igrPYcc", "CaE8oUsYRCvRByMYBRrg7vjaaSa4fbHSwXKEdBj8EKNf"]
      },
      {
        "id": "52sLrTRsiVrVyxSL8r1rpbJmjtcbQER9QgeiykViUgC8",
        "ownedNFTs": [
          {
            "id": "6K87VYDnPrhefPjBnEdi9hUfC9fr3W8qDbGnMKnyoGvP",
            "metadata": { "name": "Fly Guys #786 PURPLE" },
            "ownership": { "ownerId": "52sLrTRsiVrVyxSL8r1rpbJmjtcbQER9QgeiykViUgC8" }
          },
          {
            "id": "CQCrLu5AQ15zSBGyNodWYxXxBfYHibMN29DR1jPXaFHx",
            "metadata": { "name": "KING #3558 BLACK GUY" },
            "ownership": { "ownerId": "52sLrTRsiVrVyxSL8r1rpbJmjtcbQER9QgeiykViUgC8" }
          },
          {
            "id": "ABiGDshndLxs935LEyx5YJ6SrkeMLEBwCmtDtfFcck1W",
            "metadata": { "name": "GhostKid #1977 DARK GREEN" },
            "ownership": { "ownerId": "52sLrTRsiVrVyxSL8r1rpbJmjtcbQER9QgeiykViUgC8" }
          }
        ],
        "wantedNFTs": ["DGPXMa22xFTs6N9fiCxozJnCCEFuDA4sE555JdtckBRH", "HtyJpWfdLWDRf87LQTjMHxwdcraSAATfEwwZmcmfiihR", "G7yWHtUEfZgocWwzwChPMXnP91HUXJ2V2GnqUiovkHgs"]
      }
    ]
  }' | jq ".trades | length"

echo ""
echo "🎯 Canonical Engine Success Criteria:"
echo "- Result should be exactly 3 trades (one per collection)"
echo "- Down from 18+ legacy duplicates = 83%+ improvement"
echo "- Processing time should be significantly faster"
echo "- Memory usage dramatically reduced"


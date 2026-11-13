# Second Hop

[Open the public walkthrough](https://doggowoofwoof.github.io/second-hop/).

The trained run starts with the full corpus of the selected benchmark setting. The brighter, draggable nodes and their edges show that question’s candidate graph. Building the pool fades out the other corpus nodes and replays the recorded seed expansion. Inputs, model scores and rankings use the same pool throughout. The Walk lab is a configurable PageRank experiment; its results are separate from the trained checkpoints.

- [MetaQA: seven cast members](https://doggowoofwoof.github.io/second-hop/?case=yglesias-cast#run-ranking) and [nine films](https://doggowoofwoof.github.io/second-hop/?case=ashby-films#run-ranking). Click a correct result to see the typed path.
- [2WikiMultihopQA: two directors’ birthdays](https://doggowoofwoof.github.io/second-hop/?case=director-birthdays#run-models). One gold passage moves from rank 6 in the MLP to rank 4 in the GNN.

The static data was exported using the research repository’s original candidate construction, feature code and J5 `p@swa` weights for `zrc` (MLP) and `zsp` (one graph message pass). The Wikipedia examples use the B1 benchmark settings; MetaQA uses the canonical movie graph and its original typed-chain inputs. Exported Wikipedia scores were checked against the saved runs. An archived MetaQA query was used to check pool and feature reconstruction before scoring the two featured queries.

The Inputs inspector exports raw and standardized feature values and full-pool scores with one block masked at a time. The independent RRF term stays in the model when the search block is masked. The Models inspector can turn off the GNN’s propagation for the whole pool or remove a single neighbour’s incoming edges for the selected candidate. Neither intervention rebuilds the candidate pool. Model scores are ranking scores, not probabilities.

[Research protocol](https://github.com/DoggoWoofWoof/MLPvsGNN/blob/f30a9e421d30881936ceada05cd792809e1c652a/docs/B1B_MODELS_ON_HIPPORAG2.md) · [Dataset and passage credits](assets/passages/sources.txt)

To run the site locally, serve this directory over HTTP, for example with `python -m http.server 8000`.

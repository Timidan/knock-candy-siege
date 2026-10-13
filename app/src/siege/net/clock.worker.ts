// Worker messages keep the simulation clock independent of background-tab RAF.
setInterval(() => postMessage(null), 8)

// Chog portraits: a 512px thumbnail cached with the app, or, while the cache is still filling, the 1000px original on
// IPFS (filebase sends CORS headers, so it also works as a WebGL texture).
const CID = 'bafybeihau2egcccbdxymeckmmbrqytbfor5gkt3en6d5fsbueymdbq7g6e'

export const thumb = (id: number, lite = false) => `/chogs${lite ? '-256' : ''}/${id}.webp`
export const original = (art: number) => `https://ipfs.filebase.io/ipfs/${CID}/${art}.webp`

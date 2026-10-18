// Links that reopen a page inside a wallet app's own browser, which has window.ethereum. The full URL goes along, so ?room= invites survive.
// logo: the wallet's official mark in /art/partners (none found for Coinbase Wallet, so its button stays text-only).
export function walletLinks(href: string) {
  const page = encodeURIComponent(href)
  return [
    // https://docs.metamask.io/metamask-connect/evm/guides/metamask-exclusive/use-deeplinks/ (dappUrl without the protocol)
    { name: 'MetaMask', logo: 'metamask.svg', href: `https://link.metamask.io/dapp/${href.replace(/^https?:\/\//, '')}` },
    // https://docs.phantom.com/phantom-deeplinks/other-methods/browse
    { name: 'Phantom', logo: 'phantom.svg', href: `https://phantom.com/ul/browse/${page}?ref=${encodeURIComponent(new URL(href).origin)}` },
    // https://docs.cloud.coinbase.com/wallet-sdk/docs/deep-link-into-dapp-browser
    { name: 'Coinbase Wallet', href: `https://go.cb-w.com/dapp?cb_url=${page}` },
    // https://developer.trustwallet.com/developer/develop-for-trust/deeplinking
    { name: 'Trust Wallet', logo: 'trust-wallet.svg', href: `https://link.trustwallet.com/open_url?coin_id=60&url=${page}` },
  ]
}

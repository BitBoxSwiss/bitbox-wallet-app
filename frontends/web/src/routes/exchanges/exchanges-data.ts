export type Method = 'BT' | 'DCA' | 'CC' | 'SW' | 'P2P';
export type Region = 'NA' | 'LA' | 'EU' | 'AF' | 'APAC';

export interface ExchangeData {
    key: string; // key is used to redirect to the exchange using ext.shiftcrypto.ch/<KEY>
    link: string; // link is used to display the hostname of the exchange in the ui
    description: string;
    regions: Region[];
    payment: Method[];
}

export const data: ExchangeData[] = [
  {
    key: 'exmo',
    link: 'https://exmo.com',
    description: 'Founded in 2013 and based in London, Kiev, Barcelona, and Moscow. EXMO is fairly popular in Eastern Europe.',
    regions: ['EU', 'NA'],
    payment: ['CC', 'BT'],
  },
  {
    key: 'coinmama',
    link: 'https://www.coinmama.com/',
    description: 'Coinmama, founded in 2013, is a financial service company that makes it fast, safe and fun to buy digital currency, anywhere in the world.',
    regions: ['EU', 'NA', 'APAC'],
    payment: ['CC', 'BT'],
  },
  {
    key: 'luno',
    link: 'https://www.luno.com/en/',
    description: 'Luno makes it safe and easy to buy, store and learn about cryptocurrencies',
    regions: ['EU', 'APAC'],
    payment: ['CC', 'BT'],
  },
  {
    key: 'kraken',
    link: 'https://www.kraken.com/',
    description: 'As one of the largest and oldest Bitcoin exchanges in the world, Kraken is consistently named one of the best places to buy and sell crypto online.',
    regions: ['EU', 'NA'],
    payment: ['BT'],
  },
  {
    key: 'bity',
    link: 'https://bity.com/',
    description: 'Bity, founded in 2014 and incorporated in Switzerland is a leading provider of crypto-finance services.',
    regions: ['EU'],
    payment: ['BT'],
  },
  {
    key: 'bitstamp',
    link: 'https://www.bitstamp.net/',
    description: 'Bitstamp is one of the oldest European based cryptocurrency exchange. It allows people from all around the world to buy and sell cryptocurrencies safely.',
    regions: ['EU', 'NA', 'LA', 'APAC', 'AF'],
    payment: ['CC', 'BT'],
  },
  {
    key: 'bitcoin_suisse',
    link: 'https://www.bitcoinsuisse.com/',
    description: 'Founded in 2013, Bitcoin Suisse AG has been a pioneer in providing crypto-financial services.',
    regions: ['EU'],
    payment: ['BT'],
  },
  {
    key: 'shapeshift',
    link: 'https://shapeshift.io/',
    description: 'Founded in 2014, ShapeShift allows users to buy crypto with fiat, trade, track, and secure their crypto. Users stay in control of their keys.',
    regions: ['EU', 'NA', 'LA', 'APAC', 'AF'],
    payment: ['SW'],
  },
  {
    key: 'kyberswap',
    link: 'https://kyberswap.com/',
    description: 'KyberSwapis a fast, simple, and secure token swap platform.',
    regions: ['EU', 'NA', 'LA', 'APAC', 'AF'],
    payment: ['SW'],
  },
  {
    key: 'hodlhodl',
    link: 'https://hodlhodl.com',
    description: 'Hodl Hodl is a global P2P Bitcoin trading platform, where all trades occur directly between buyers and sellers, and without a middleman involved - locking it in multisig escrow instead.',
    regions: ['EU', 'NA', 'LA', 'APAC', 'AF'],
    payment: ['P2P'],
  },
  {
    key: 'bisq',
    link: 'https://bisq.network',
    description: 'Bisq is an open-source, peer-to-peer application that allows you to buy and sell cryptocurrencies in exchange for national currencies. No registration required.',
    regions: ['EU', 'NA', 'LA', 'APAC', 'AF'],
    payment: ['P2P'],
  },
  {
    key: 'paxful',
    link: 'https://paxful.com',
    description: 'Paxful is a peer-to-peer marketplace to buy and sell bitcoin with 300+ payment methods.',
    regions: ['EU', 'NA', 'LA', 'APAC', 'AF'],
    payment: ['P2P'],
  },
  {
    key: 'paybtc',
    link: 'https://paybtc.com.au',
    description: 'Based in Australia, paybtc is a Bitcoin only exchange that provides instant selling to any bank account along with the ability to easily pay your bills with Bitcoin.',
    regions: ['APAC'],
    payment: ['BT'],
  },
  {
    key: 'localcryptos',
    link: 'https://localcryptos.com/',
    description: 'LocalCryptos is a peer-to-peer marketplace where people exchange crypto with each other.',
    regions: ['EU', 'NA', 'LA', 'APAC', 'AF'],
    payment: ['P2P'],
  },
  {
    key: 'xsats',
    link: 'https://www.xsats.com/',
    description: 'xSats is a service that allows you to buy Bitcoin on a regular basis via bank transfer. The Bitcoin is sent straigt to your wallet.',
    regions: ['EU'],
    payment: ['DCA'],
  },
  {
    key: 'bullbitcoin',
    link: 'https://bullbitcoin.com/recurring-buys',
    description: 'Bull Bitcoin is a fixed rate Bitcoin exchange for Canadians to buy, sell and spend bitcoins online.',
    regions: ['NA'],
    payment: ['BT', 'DCA'],
  },
  {
    key: 'river_financial',
    link: 'https://river.com/',
    description: 'Based in San Francisco, River Financial is a firm dedicated to helping people invest in Bitcoin. We provide our users with premium customer service and access to cutting edge Bitcoin features, like the Lightning Network.',
    regions: ['NA'],
    payment: ['BT', 'DCA'],
  },
  {
    key: 'bitdroplet',
    link: 'https://bitdroplet.com/',
    description: 'Bitdroplet is a convenient and secure platform which allows an investor to invest in cryptocurrencies through a Systematic Purchase Plan on a monthly basis.',
    regions: ['APAC'],
    payment: ['DCA'],
  },
  {
    key: 'myetherwallet',
    link: 'https://www.myetherwallet.com',
    description: 'MyEtherWallet is a free, client-side interface helping you interact with the Ethereum blockchain. Our easy-to-use, open-source platform allows you to generate wallets, interact with smart contracts, and so much more.',
    regions: ['EU', 'NA', 'LA', 'APAC', 'AF'],
    payment: ['SW'],
  }, {
    key: 'oasis_dex',
    link: 'https://oasis.app',
    description: 'Oasis is a platform for decentralized finance. Use it to trade tokens, borrow Dai, and earn savings — all in one place.',
    regions: ['EU', 'NA', 'LA', 'APAC', 'AF'],
    payment: ['SW'],
  }, {
    key: 'defi_saver',
    link: 'https://defisaver.com',
    description: 'DeFi Saver is a one-stop management solution for decentralized finance protocols.',
    regions: ['EU', 'NA', 'LA', 'APAC', 'AF'],
    payment: ['SW'],
  }, {
    key: 'swan_bitcoin',
    link: 'https://www.swanbitcoin.com/BitBox',
    description: 'Swan is the easiest and most affordable way to accumulate Bitcoin with automatic recurring purchases. Start your plan today and get $10 of free Bitcoin dropped into your account.',
    regions: ['NA'],
    payment: ['DCA'],
  },
];

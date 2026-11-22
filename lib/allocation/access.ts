import type { AccessNote } from "./types";

export const ACCESS = {
  setEtf: {
    channel: "thai_broker",
    title: "Thai brokerage account",
    detail:
      "Listed on SET. Buy and sell it in a Thai broker's trading app. Houses that offer this include InnovestX, KSecurities, Bualuang Securities, Finansia Syrus, Dime, and Maybank, among others. You need a securities account with ATS to a Thai bank. The board lot is 100 units and the quote is in baht. This is access context, not a ranking of brokers.",
  } satisfies AccessNote,
  setStock: {
    channel: "thai_broker",
    title: "Thai brokerage account",
    detail:
      "Ordinary SET share. Same securities account and trading app as any SET stock. Board lot is 100 shares. A single name can gap on news that the SET50 ETF absorbs, which is why it sits as a satellite rather than the core.",
  } satisfies AccessNote,
  setReit: {
    channel: "thai_broker",
    title: "Thai brokerage account",
    detail:
      "SET-listed property trust. Trade it like a stock in a Thai broker app, in board lots of 100. Distributions and lease expiry sit in the trust deed, which is worth reading before the first purchase.",
  } satisfies AccessNote,
  bankFund: {
    channel: "bank_fund",
    title: "Bank mutual-fund platform",
    detail:
      "Buy with the fund code on a Thai bank investment menu, for example K PLUS or K-My Funds, SCB EASY, Bangkok Bank, Krungthai NEXT, or ttb, if that bank distributes the fund. You deal at the day's NAV, not against an exchange order book. Cut-off times are in the factsheet.",
  } satisfies AccessNote,
  offshore: {
    channel: "offshore_broker",
    title: "Offshore broker",
    detail:
      "US-listed ETF. Residents of Thailand have historically been able to open an account at Interactive Brokers, subject to that firm's review, a W-8BEN, and an international wire. US-situs assets can fall inside US estate tax above the statutory threshold. Confirm the current onboarding rules before you wire money. This is not a recommendation of any broker.",
  } satisfies AccessNote,
  dr: {
    channel: "set_dr",
    title: "Depositary receipt on SET",
    detail:
      "Some foreign shares trade as depositary receipts in baht on SET, through an ordinary Thai broker. The list changes. This desk does not assign a DR ticker unless the line is the instrument itself. Check the SET DR board if you would rather hold a foreign name in baht.",
  } satisfies AccessNote,
};

import { createContext, useContext } from 'react';

/*
 * What the Backtest just read, offered to the form that composed it. The Lab
 * already holds the answer for the current draft, so a control that changes the
 * sample can say what it did without asking for the read again.
 *
 * Its own module so the Lab can provide it without the form importing the Lab,
 * which would close a cycle: Lab → Form → Conditions.
 */
const BacktestSampleContext = createContext(null);

export const BacktestSampleProvider = BacktestSampleContext.Provider;

// Null wherever no Lab is above, which is a form with no evidence beneath it.
export const useBacktestSample = () => useContext(BacktestSampleContext);

export const countAppearances = (backtest) =>
  backtest ? backtest.players.reduce((total, player) => total + player.games.length, 0) : null;

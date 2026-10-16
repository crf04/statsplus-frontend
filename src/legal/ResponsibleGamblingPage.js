import { Link } from 'react-router-dom';
import LegalPage, { LegalSection } from './LegalPage';
import {
  FACTS_NOT_ADVICE,
  HELPLINE,
  HELPLINE_DIGITS,
  HELPLINE_HREF,
  TERMS_PATH,
} from './legalConfig';

const ResponsibleGamblingPage = () => (
  <LegalPage
    title="Responsible gambling"
    lede="CourtAI is for adults who are 21 or older. Betting should stay fun, and it should never cost you more than you can afford."
  >
    <LegalSection id="rg-help" title="Need help?">
      <p>
        Call{' '}
        <a href={HELPLINE_HREF} className="legal-helpline">
          {HELPLINE}
        </a>{' '}
        ({HELPLINE_DIGITS}), the national problem gambling helpline. It is also for people worried
        about someone else&apos;s gambling.
      </p>
    </LegalSection>

    <LegalSection id="rg-facts" title="Facts, not advice">
      <p>{FACTS_NOT_ADVICE}</p>
      <p>
        A hit rate or a Matchup score describes games that are over. No number in CourtAI makes a
        result certain.
      </p>
    </LegalSection>

    <LegalSection id="rg-habits" title="Keep it in bounds">
      <ul>
        <li>Bet only what you can afford to lose.</li>
        <li>Set a limit before you start, and stop when you reach it.</li>
        <li>Do not chase losses.</li>
        <li>Take breaks, and do not bet when you are upset or have been drinking.</li>
      </ul>
      <p>
        Sportsbooks and many states let you set deposit limits or exclude yourself. Ask your
        sportsbook or your state gaming regulator.
      </p>
    </LegalSection>

    <LegalSection id="rg-age" title="21 and over">
      <p>
        You must be 21 or older to use CourtAI. The <Link to={TERMS_PATH}>Terms</Link> say more.
      </p>
    </LegalSection>
  </LegalPage>
);

export default ResponsibleGamblingPage;

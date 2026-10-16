import { Link } from 'react-router-dom';
import LegalPage, { LegalSection } from './LegalPage';
import {
  CONTACT_EMAIL,
  DATA_SOURCE,
  FACTS_NOT_ADVICE,
  GOVERNING_STATE,
  OPERATOR_NAME,
  PRIVACY_PATH,
  RESPONSIBLE_GAMBLING_PATH,
} from './legalConfig';

const TermsPage = () => (
  <LegalPage
    title="Terms of Use"
    lede="These terms cover your use of CourtAI, its website and its Claude and ChatGPT connector. By signing in or using the connector you accept them."
  >
    <LegalSection id="terms-who" title="Who we are">
      <p>
        CourtAI is run by {OPERATOR_NAME} (&ldquo;we&rdquo;). You can reach us at{' '}
        <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
      </p>
    </LegalSection>

    <LegalSection id="terms-age" title="21 and over">
      <p>
        You must be 21 or older to use CourtAI. If you are younger, do not sign in and do not use
        the connector.
      </p>
    </LegalSection>

    <LegalSection id="terms-facts" title="Facts, not advice">
      <p>{FACTS_NOT_ADVICE}</p>
      <p>
        CourtAI shows what happened in NBA games and how teams have defended. The numbers describe
        the past. They do not say what will happen, and they are not a recommendation to bet or to
        pass. What you do with them is your decision and your risk.
      </p>
      <p>
        CourtAI does not take bets, hold money or sell picks. Read{' '}
        <Link to={RESPONSIBLE_GAMBLING_PATH}>Responsible gambling</Link> if you bet.
      </p>
    </LegalSection>

    <LegalSection id="terms-data" title="Data and sources">
      <p>
        {DATA_SOURCE}. Game and player statistics come from NBA.com, and some play-by-play figures
        also draw on PBP Stats. CourtAI is not affiliated with or endorsed by the NBA or any team.
      </p>
      <p>
        Betting lines and market prices, where we show them, come from third-party providers. They
        change quickly, can be late or wrong, and may differ from what a sportsbook offers you.
      </p>
    </LegalSection>

    <LegalSection id="terms-account" title="Your account">
      <p>
        You sign in with Google. You are responsible for what happens under your account. During the
        beta we may place accounts on a waitlist, and we may limit or close an account that breaks
        these terms.
      </p>
      <p>
        What we keep about you is described in the <Link to={PRIVACY_PATH}>Privacy Policy</Link>.
      </p>
    </LegalSection>

    <LegalSection id="terms-use" title="Using CourtAI">
      <p>
        Use CourtAI for your own research. Do not scrape it, resell or republish its data in bulk,
        probe it for security weaknesses, or interfere with how it runs. Using the connector with
        Claude or ChatGPT as the Connect page describes is fine. Answers sent to an assistant are
        handled by that assistant under its own terms.
      </p>
    </LegalSection>

    <LegalSection id="terms-warranty" title="No warranty">
      <p>
        CourtAI is provided &ldquo;as is&rdquo;, without promises that it is accurate, complete,
        current or always available. To the extent the law allows, {OPERATOR_NAME} is not liable for
        any loss from using or relying on CourtAI, including betting losses.
      </p>
    </LegalSection>

    <LegalSection id="terms-changes" title="Changes and law">
      <p>
        We may change these terms. The date at the top is the latest version, and using CourtAI
        after a change means you accept it. These terms are governed by the laws of{' '}
        {GOVERNING_STATE}.
      </p>
    </LegalSection>
  </LegalPage>
);

export default TermsPage;

import { Link } from 'react-router-dom';
import LegalPage, { LegalSection } from './LegalPage';
import { CONTACT_EMAIL, OPERATOR_NAME, TERMS_PATH } from './legalConfig';

const Rows = ({ rows }) => (
  <table className="legal-table">
    <tbody>
      {rows.map(([name, detail]) => (
        <tr key={name}>
          <th scope="row">{name}</th>
          <td>{detail}</td>
        </tr>
      ))}
    </tbody>
  </table>
);

const COLLECTED = [
  [
    'Sign-in with Google',
    'When you sign in, Google sends us your email address, name, profile photo link and account id through Firebase. We also record when your account was created, when you last used it, and whether it is on the beta waitlist.',
  ],
  [
    'Where you came from',
    'When you first open CourtAI, your browser saves the first page you landed on (its path only), the campaign tags and ref code in the link, the website that sent you, and the time. It stays in your browser until you sign in. Then we save it once on your account, so we can see which links bring people here. Signing out does not clear it.',
  ],
  [
    'What you save',
    'Saved Filter Sets and Targets, including any note you write on a Target. Every new account also gets a few starter Targets.',
  ],
  [
    'Your searches',
    'The text of a plain-English search goes to our server to be understood and is written to our server logs with your email and account id. If our own reader is unsure, the text is also sent to OpenAI.',
  ],
  [
    'Activity counts',
    'We keep a count, per account and per day (US Eastern), of how many times you open a Matchup, a player profile, an Opposing Team Profile, a search or a Target run. We keep no log of each request, and the counts do not include what you searched for. We use them to see which features people use and to report weekly activity by where accounts came from. An admin can label an account, for example as a friend or team member, so reports can set it apart.',
  ],
  [
    'Server logs',
    'Our servers log each request: the route, the result, the time it took and a request reference (the "ref" on an error message). For a signed-in request the log also holds your email and account id. We use your IP address to limit how fast requests can arrive, and our hosts may log it as part of serving the site.',
  ],
  [
    'Errors',
    'If CourtAI breaks, Sentry receives the error, the page path, browser details and the request reference. We set it to leave out your account details, search text and session recordings.',
  ],
];

const PROVIDERS = [
  ['Google (Firebase)', 'Signs you in. Holds your Google account details and sign-in tokens.'],
  [
    'Vercel',
    'Hosts the website and passes your requests to our server, so your requests, search text and sign-in token pass through it.',
  ],
  [
    'Railway',
    'Runs our server, database and connector. It holds everything described above, plus a cache of stats and short-lived counters that limit request rates. Those counters are tied to your account id or IP address and last about a minute. A daily count of AI-assisted searches per account lasts two days.',
  ],
  [
    'OpenAI',
    'Reads a plain-English search our own reader is unsure about. It gets the text of that search and the names of players we matched in it. It does not get your name, email or account id.',
  ],
  ['Sentry', 'Receives error reports, as under Errors above.'],
  [
    'Google Fonts and NBA.com',
    'Your browser loads fonts from Google and player photos from NBA.com, so they see your IP address and browser details, as any site you visit would.',
  ],
];

const PrivacyPage = () => (
  <LegalPage
    title="Privacy Policy"
    lede="What CourtAI collects, who handles it, and what you can ask us to do."
  >
    <LegalSection id="privacy-short" title="The short version">
      <ul>
        <li>
          We collect what Google sends when you sign in, what you save, and the technical records
          needed to run CourtAI.
        </li>
        <li>
          We do not sell your personal data. CourtAI shows no ads and runs no advertising or
          third-party analytics services.
        </li>
        <li>
          You can ask us to delete your data at{' '}
          <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
        </li>
      </ul>
    </LegalSection>

    <LegalSection id="privacy-collected" title="What we collect">
      <Rows rows={COLLECTED} />
    </LegalSection>

    <LegalSection id="privacy-providers" title="Who handles it">
      <Rows rows={PROVIDERS} />
    </LegalSection>

    <LegalSection id="privacy-connector" title="The Claude and ChatGPT connector">
      <p>
        You sign in with Google on a CourtAI page to connect. We then store a grant: your account
        id, the app you connected, and your Google sign-in refresh token, encrypted. A grant stops
        working after 30 days without use.
      </p>
      <p>
        We log each connector request: the tool, the filters the assistant passed (such as a player
        name), a one-way code for your account, and the time it took. We see those requests, not
        your conversation. The answers go to the assistant you chose, including your Targets and
        their notes if you ask about them, and that assistant handles them under its own terms.
      </p>
      <p>
        To disconnect, remove CourtAI in your assistant. To have the stored grant deleted, email us.
      </p>
    </LegalSection>

    <LegalSection id="privacy-keep" title="Keeping and deleting">
      <p>
        We keep your account data until you ask us to delete it. Email{' '}
        <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a> from the address on your account and
        we will delete your CourtAI data: your account, Targets, Filter Sets, attribution and
        connector grants, and your Firebase sign-in record. Server logs are kept by our host under
        its own retention settings.
      </p>
    </LegalSection>

    <LegalSection id="privacy-age" title="Under 21">
      <p>
        CourtAI is for people 21 and over, and we do not knowingly collect data from anyone younger.
        See the <Link to={TERMS_PATH}>Terms</Link>.
      </p>
    </LegalSection>

    <LegalSection id="privacy-changes" title="Changes and contact">
      <p>
        If this page changes, the date at the top changes. Questions go to {OPERATOR_NAME} at{' '}
        <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
      </p>
    </LegalSection>
  </LegalPage>
);

export default PrivacyPage;

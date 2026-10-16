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
    'When you first open CourtAI, your browser saves the first page you landed on (its path only), the campaign tags and ref code in the link, the address of the website that sent you, and the time. It stays in your browser, even after you sign in or out, until you clear your browser data. When an account signs in, we save a copy on that account once, so we can see which links bring people here. A different person who signs in on the same browser would get a copy too.',
  ],
  [
    'What you save',
    'Saved Filter Sets and Targets, including any note you write on a Target. Every new account also gets a few starter Targets.',
  ],
  [
    'Your searches',
    "The text of a plain-English search goes to our server to be understood and is written to our server logs with your email and account id. If our own reader is unsure, the text is also sent to OpenAI. About one in ten of the searches our reader is sure about is sent too, in the background, only so we can check how often the two agree; you still get our reader's answer.",
  ],
  [
    'Activity counts (planned)',
    'We are adding a count, per account and per day (US Eastern), of your successful research actions: loading a Matchup, a player profile or an Opposing Team Profile, running a search or game-log query, and running or backtesting a Target. It will hold only the count, not which pages or searches. We will use it to report weekly activity by where accounts came from. An admin will be able to label an account, for example as a friend or team member, so reports can set it apart.',
  ],
  [
    'Server logs',
    'Our servers log each request: the route, the result, the time it took and a request reference (the "ref" on an error message). For a signed-in request the log also holds your email and account id. We use your IP address to limit how fast requests can arrive, and our hosts may log it as part of serving the site.',
  ],
  [
    'Errors',
    'If CourtAI breaks, Sentry receives the error, the page path, browser details and the request reference. We set it to leave out your account details, session recordings and request bodies, and to remove emails and tokens from error text. An error message can still contain something typed into a request, such as a player name.',
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
    "Runs our server, database, Redis cache and connector. It holds everything described above, plus cached stats and short-lived counters that limit request rates. The server's counters are tied to your account id or IP address and last about a minute. The connector keeps a per-minute and a per-day count for each connected account in memory until it restarts. A daily count of each account's OpenAI calls for searches our reader is unsure about lasts two days.",
  ],
  [
    'OpenAI',
    'Reads a plain-English search our own reader is unsure about. It also reads about one in ten of the searches our reader is sure about, in the background, so we can compare its answer with ours. It gets the text of that search, including anything personal you type, plus the names of players we matched in it. We attach no account details. We write the compared search and the result of the comparison to our server logs.',
  ],
  ['Sentry', 'Receives error reports, as under Errors above.'],
  [
    'Google Fonts and NBA.com',
    'Your browser loads fonts from Google and player photos from NBA.com, so they see your IP address and browser details, as any site you visit would. Some connector cards in Claude or ChatGPT load Google Fonts the same way.',
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

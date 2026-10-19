import { Link } from 'react-router-dom';
import LegalPage, { SupportEmail } from './LegalPage';

/**
 * Written from what the code actually stores and sends (crf04/statsplus#246):
 * keep it in step when a table, log, processor or browser key changes.
 */
const PrivacyPage = () => (
  <LegalPage title="Privacy Policy">
    <p>
      CourtAI (&ldquo;we&rdquo;) runs courtai.app, an NBA stats research tool, and the CourtAI
      connector at mcp.courtai.app that lets AI apps such as Claude and ChatGPT read your CourtAI
      data and, when you ask, save Targets and Saved Filter Sets to your account. This policy
      explains what we collect, why, and the choices you have. Questions go to <SupportEmail />.
    </p>

    <h2>What we collect</h2>
    <ul>
      <li>
        <strong>Your account.</strong> You sign in with Google. We receive and store your email
        address, name, profile photo and account ID, plus when you signed up, when you last signed
        in, and whether your account is active or on the waitlist. We never see your Google
        password.
      </li>
      <li>
        <strong>What you create.</strong> Targets (including any notes you write on them), saved
        filter sets, and the searches you type.
      </li>
      <li>
        <strong>How you found us.</strong> If you arrive through a link with campaign or referral
        tags, we keep those tags, the site that referred you, the first page you landed on and when,
        and attach them to your account when you sign in.
      </li>
      <li>
        <strong>Usage.</strong> A daily count of research actions per account. We may also label
        accounts, for example our own and invited testers, so we can tell them apart in these
        counts.
      </li>
      <li>
        <strong>Connected AI apps.</strong> When you connect an AI app to CourtAI, we store an
        encrypted credential that lets it read your CourtAI data on your behalf, plus the
        app&rsquo;s registration details. Each request it makes is logged with a pseudonymous
        account ID (not your email), the tool and the inputs it used, timing and the outcome.
      </li>
      <li>
        <strong>Technical data.</strong> Your IP address, used to rate-limit visitors who are not
        signed in. Server logs, which record requests and, for natural-language searches, your
        account ID and the start of the search text. Error reports, which are not linked to your
        account and from which we remove email addresses and sign-in tokens before they are sent;
        they can still contain other text from the error, such as a search you typed.
      </li>
    </ul>

    <h2>How we use it</h2>
    <p>
      To sign you in, save and show your work, answer your searches, serve the AI apps you connect,
      keep the service running and protect it from abuse, fix errors, and understand which links
      bring people to CourtAI. We do not sell your personal information, we do not show ads, and we
      do not use third-party analytics or advertising trackers.
    </p>

    <h2>Who else handles it</h2>
    <p>We use these providers to run CourtAI. Each processes data only to provide its service:</p>
    <ul>
      <li>
        <strong>Google (Firebase Authentication)</strong> for sign-in.
      </li>
      <li>
        <strong>Vercel</strong> hosts the website.
      </li>
      <li>
        <strong>Railway</strong> hosts our servers, database and logs.
      </li>
      <li>
        <strong>Sentry</strong> receives error reports, as described above.
      </li>
      <li>
        <strong>OpenAI</strong> receives the text of some natural-language searches, along with
        player names, to work out what you asked for.
      </li>
    </ul>
    <p>
      An AI app you connect, such as Claude or ChatGPT, receives the CourtAI data it requests for
      you, and handles it under its own privacy policy. We may also disclose information if the law
      requires it.
    </p>

    <h2>Cookies and browser storage</h2>
    <p>
      We do not use advertising or tracking cookies. Google sign-in keeps your session in your
      browser&rsquo;s storage. We also store how you first arrived, a copy of the home page&rsquo;s
      data so it loads faster, and, during sign-in, the action to resume afterwards. Clearing your
      browser&rsquo;s site data removes them.
    </p>

    <h2>How long we keep it</h2>
    <p>
      We keep account data and what you create while your account exists. A connected AI app&rsquo;s
      access stops working after 30 days without use; its encrypted credential is deleted when that
      access is revoked, and otherwise kept until you ask us to delete your data. Logs and error
      reports are kept only as long as our hosting and error-reporting providers retain them. The
      website&rsquo;s rate-limit counters expire within days; the connector&rsquo;s are held in
      memory and cleared when it restarts.
    </p>

    <h2>Your choices</h2>
    <ul>
      <li>You can delete any Target or saved filter set in the app.</li>
      <li>You can disconnect an AI app from that app&rsquo;s connector settings.</li>
      <li>
        To see, correct, or delete your account and its data, email <SupportEmail /> from the
        address you sign in with. We will answer within 30 days.
      </li>
    </ul>

    <h2>Security</h2>
    <p>
      Data travels over HTTPS. Connected-app credentials are encrypted at rest, and only hashes of
      the connector&rsquo;s own tokens are stored. No system is perfectly secure, so please tell us
      at <SupportEmail /> if you find a problem.
    </p>

    <h2>Children</h2>
    <p>
      CourtAI is not intended for anyone under 18, and we do not knowingly collect data from them.
      If you believe a minor has signed up, contact us and we will delete the account.
    </p>

    <h2>Changes</h2>
    <p>
      If we change this policy, we will post the new version here and update the effective date
      above. See also our <Link to="/terms">Terms of Service</Link>.
    </p>
  </LegalPage>
);

export default PrivacyPage;

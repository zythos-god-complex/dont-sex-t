// Privacy policy and terms of use. Plain words, written to match what the app actually does.
import { useEffect } from 'react'
import { useLocation } from 'wouter'
import { IconBack } from '../../ui/icons'
import { Wordmark } from '../../ui/kit'
import { goBack } from '../shell/nav'
import { CONTACT_EMAIL, mailto } from '../../lib/contact'

const UPDATED = '18 october 2026'

type Sec = { h: string; p: (string | string[])[] }

const contact = CONTACT_EMAIL
  ? `email us at ${CONTACT_EMAIL}, or use the report and appeal tools in the app.`
  : 'use the report and appeal tools in the app. we read every one.'

const PRIVACY: Sec[] = [
  {
    h: 'the short version',
    p: [
      'strangers cafe is a place to chat with strangers and friends. we collect as little as we can, we never sell your data, we show no ads, and chat messages, photos and voice notes are wiped from our servers about 24 hours after they are sent.',
    ],
  },
  {
    h: 'who we are',
    p: [`strangers cafe ("we", "us") runs the app at strangers.cafe and decides how your data is used, which makes us the data controller (or data fiduciary under india's DPDP Act). to reach us or our grievance officer, ${contact}`],
  },
  {
    h: 'what we collect',
    p: [
      [
        'account: your username, gender, the face you build or a profile photo, and a hashed version of your session token and recovery key (we never store the 6 words themselves).',
        'things you choose to add: bio, place, mood, a song, your birth month and year (only if you stamp your age), and settings like status, seen and ghost mode.',
        'what you send: messages, stickers, games, photos, view once photos, doodles, voice notes, reactions and reports.',
        'save requests: when someone asks to save your voice note or photo, and what you answered.',
        'shop: your goof coin balance, what you unlocked and when, and each ad you watched for coins (so balances stay right and nobody farms them).',
        'social stuff: who you chat with, friends, blocks, rooms you are in, streaks, badges and simple counts like how many messages you have sent.',
        'presence: when you are online, typing or away, and when you were last seen (you can hide this in settings).',
        'previous usernames, which people you chat with can see.',
        'technical bits: your device push subscription if you turn on notifications, and IP address and basic request logs kept by our hosting providers for security.',
        'anonymous usage stats from Vercel Analytics, which uses no cookies and does not identify you.',
      ],
    ],
  },
  {
    h: 'what we do not collect',
    p: ['no real name, email, phone number, contacts, precise location or payment details. we do not run ad trackers and we do not build ad profiles.'],
  },
  {
    h: 'why we use it',
    p: [
      [
        'to run the app: match you with people, deliver messages, show profiles and keep you signed in.',
        'to keep people safe: handle reports, review profile photos before they go live, stop spam and enforce the terms.',
        'to show age gated stuff only to people who say they are 18 or older.',
        'to send notifications you turned on.',
        'to fix bugs and understand overall usage.',
      ],
      'our legal bases (where the law asks for one): running the service you asked for, our legitimate interest in keeping it safe, your consent for optional things like notifications and your birth date, and legal obligations.',
    ],
  },
  {
    h: 'how long we keep it',
    p: [
      [
        'chat and room messages, reactions, photos and voice notes: deleted from our servers about 24 hours after they are sent. view once photos are gone once opened.',
        'your app also keeps a copy of your chats on your own device so your history stays with you. clearing site data or deleting a chat removes it there.',
        'profile and account data: until you use forget me.',
        'coin balance, unlocks and ad records: as long as the account exists, to keep balances right and catch abuse.',
        'if you let someone save your voice note or photo, they keep their own copy on their device, outside our 24 hour wipe.',
        'reports and moderation records: as long as needed to keep people safe and handle appeals.',
        'temp accounts: the sign in only lives in that browser tab. the account record and anything still within 24 hours stays on our servers until it ages out like everything else.',
      ],
    ],
  },
  {
    h: 'who sees it',
    p: [
      [
        'other users see your public profile (name, face or photo, bio, place, age if you show it, song, badges, mood) and whatever you send them.',
        'moderators see reports, the reason picked, profile photos waiting for review and the account details needed to act. we do not read private chats.',
        'service providers that run the app for us: Supabase (database, storage, realtime) and Vercel (hosting and analytics). song search goes through the Apple iTunes search service, and notifications go through your browser maker (Apple, Google or Mozilla).',
        'authorities, only when the law requires it or to protect someone from serious harm.',
      ],
      'ads: there are no ads yet, only placeholders. before real ads go live we will update this policy, name the ad partner, and ask for your consent where the law requires it. an ad partner may then get basic device and ad interaction data to show and count an ad.',
      'we never sell or share your personal data for advertising.',
    ],
  },
  {
    h: 'where it lives',
    p: ['our providers may store and process data outside your country. where the law requires it, transfers rely on the providers\' standard contractual clauses and security commitments.'],
  },
  {
    h: 'your rights',
    p: [
      'depending on where you live (for example the EU and UK under GDPR, california under CCPA, india under the DPDP Act, brazil under LGPD), you can ask to access, correct, delete or get a copy of your data, object to or limit some uses, withdraw consent, and complain to your local data protection authority.',
      [
        'edit your profile any time from your face in the top corner.',
        'forget me (settings) wipes your messages, name, face, photo, bio, place, song, birthday and recovery key, and locks the leftover anonymous record so it cannot be used again.',
        `for anything else, ${contact}`,
      ],
      'we will not treat you differently for using these rights.',
    ],
  },
  {
    h: 'kids',
    p: ['you must be at least 13 to use strangers cafe, or older if your country sets a higher age for using apps like this without a parent (for example 16 in some EU countries). if you are under 18, you need a parent or guardian\'s okay. 18+ content is only for people who stamp an age of 18 or more. if you think a child under 13 is using the app, report them and we will remove the account.'],
  },
  {
    h: 'security',
    p: ['traffic is encrypted in transit, tokens and recovery keys are stored hashed, and access to the database is locked down to the app\'s own functions. view once photos go dark when the app loses focus, but no website can fully block screenshots or a second camera. no system is perfect, so do not send anything you could not stand to see leaked, and never share your recovery key.'],
  },
  {
    h: 'changes',
    p: ['if we change this policy we will update the date above, and for big changes we will tell you in the app.'],
  },
]

const TERMS: Sec[] = [
  {
    h: 'the deal',
    p: ['by using strangers cafe you agree to these terms and the privacy policy. if you do not agree, please do not use the app.'],
  },
  {
    h: 'who can use it',
    p: [
      [
        'you are at least 13, or the minimum age for using apps like this in your country if that is higher.',
        'if you are under 18, a parent or guardian has said yes.',
        'you only turn on 18+ stuff if you really are 18 or older. lying about your age is on you.',
        'you have not been banned from strangers cafe before.',
      ],
    ],
  },
  {
    h: 'you are talking to strangers',
    p: [
      'we do not check who anyone is or how old they are, and people can lie. keep yourself safe:',
      [
        'never share your address, school, workplace, passwords, bank details or anything that could locate you.',
        'never send money or gift cards, and never meet someone from here in person without telling someone you trust.',
        'block and report anyone who makes you uncomfortable. leaving a chat is always fine.',
        'if someone is in danger, contact local emergency services right away.',
      ],
    ],
  },
  {
    h: 'house rules',
    p: [
      'do not use strangers cafe to:',
      [
        'harass, bully, threaten, stalk or blackmail anyone.',
        'post hate based on race, religion, caste, gender, sexuality, disability or similar.',
        'share anything sexual involving minors. zero tolerance: we ban instantly and report to authorities.',
        'send nudity or sexual photos or voice notes, or share anyone\'s intimate images without their consent.',
        'push sexual chat on anyone who has not turned on 18+ or did not ask for it.',
        'share someone else\'s personal info, or pretend to be someone you are not.',
        'promote self harm, violence, terrorism, drugs or anything illegal.',
        'spam, scam, phish, advertise, or use bots, scripts or scraping.',
        'fake ad views or farm goof coins with bots, scripts, emulators or other tricks.',
        'repost someone\'s voice notes or photos without their ok, even ones they let you save.',
        'break, overload or get around the app\'s security, limits or bans.',
        'infringe anyone\'s copyright or other rights.',
      ],
    ],
  },
  {
    h: 'goof coins and the shop',
    p: [
      [
        'goof coins come from watching ads in the shop and from gifts we hand out. you cannot buy them with money, and they have no cash value.',
        'coins and unlocks cannot be sold, traded, transferred or cashed out, and they stay with the account that got them.',
        'unlocking something gives you the right to use it in the app. it is not property, and we can change, rename or retire items and change prices.',
        'we can remove coins or unlocks that came from bugs, cheating or fake ad views, and limit how many ads count each day.',
        'temp accounts cannot collect coins. if your account is banned, forgotten or the app shuts down, its coins and unlocks go with it, and since nothing was paid there is nothing to refund.',
      ],
    ],
  },
  {
    h: 'your stuff',
    p: ['you own what you send. you give us the permission we need to store, transmit and show it to the people you send it to, just to run the app. you are responsible for what you send and for having the right to send it.'],
  },
  {
    h: 'moderation',
    p: ['we can review reports, remove content, limit features, or suspend and ban accounts that break these rules or put people at risk, with or without warning. if you think we got it wrong, use the appeal option in the app. we also act on valid legal requests and notices of illegal content or copyright infringement, which you can send through the contact below.'],
  },
  {
    h: 'your account',
    p: ['keep your recovery key safe. anyone with your name and 6 words can get into your account, and we cannot recover it for you without them. temp accounts end when you close the tab. you can leave any time with forget me.'],
  },
  {
    h: 'no guarantees',
    p: [
      'strangers cafe is a free hobby project provided "as is" and "as available". we do not promise it will always work, be bug free, keep your messages, or that other users are who they say they are.',
      'other users are responsible for what they say and do, not us. to the fullest extent the law allows, we are not liable for any indirect or consequential loss, or for anything caused by other users, your own choices, or things outside our control, and our total liability is limited to zero, since you pay nothing.',
      'you agree to cover us for claims that come from you breaking these terms or the law.',
      'nothing here takes away rights you have under consumer laws that cannot be waived where you live.',
    ],
  },
  {
    h: 'changes and ending',
    p: ['we can change these terms or the app, or shut it down. if the change matters we will tell you in the app, and continuing to use it means you accept the new terms. you can stop using it at any time.'],
  },
  {
    h: 'law and contact',
    p: [`these terms are governed by the laws of india, without taking away protections you have under the laws of your own country. for questions, complaints or our grievance officer, ${contact} we aim to acknowledge complaints within 24 hours and resolve them within 15 days.`],
  },
]

function Doc({ title, secs }: { title: string; secs: Sec[] }) {
  return (
    <>
      <h1 className="legal-h1">{title}</h1>
      <p className="legal-date">last updated {UPDATED}</p>
      {secs.map((s) => (
        <section key={s.h} className="legal-sec">
          <h2>{s.h}</h2>
          {s.p.map((x, i) =>
            Array.isArray(x) ? (
              <ul key={i}>
                {x.map((li) => (
                  <li key={li}>{li}</li>
                ))}
              </ul>
            ) : (
              <p key={i}>{x}</p>
            ),
          )}
        </section>
      ))}
      <section className="legal-sec legal-contact">
        <h2>contact</h2>
        <p>
          questions, data requests, complaints, appeals, legal or copyright notices:{' '}
          <a href={mailto('strangers cafe')}>{CONTACT_EMAIL}</a>
        </p>
      </section>
    </>
  )
}

export default function Legal({ page }: { page: 'privacy' | 'terms' }) {
  const [, nav] = useLocation()
  useEffect(() => {
    const prev = document.title
    document.title = (page === 'privacy' ? 'privacy policy' : 'terms of use') + ' · strangers cafe'
    window.scrollTo(0, 0)
    return () => {
      document.title = prev
    }
  }, [page])
  return (
    <div className="legal">
      <header className="legal-head">
        <button type="button" className="icon-btn" aria-label="back" onClick={() => goBack(nav)}>
          <IconBack size={26} />
        </button>
        <Wordmark size={20} />
        <nav className="legal-tabs" aria-label="legal pages">
          <a href="/privacy" className={page === 'privacy' ? 'is-on' : ''} aria-current={page === 'privacy' ? 'page' : undefined} onClick={(e) => (e.preventDefault(), nav('/privacy', { replace: true }))}>
            privacy
          </a>
          <a href="/terms" className={page === 'terms' ? 'is-on' : ''} aria-current={page === 'terms' ? 'page' : undefined} onClick={(e) => (e.preventDefault(), nav('/terms', { replace: true }))}>
            terms
          </a>
        </nav>
      </header>
      <main className="legal-body">{page === 'privacy' ? <Doc title="privacy policy" secs={PRIVACY} /> : <Doc title="terms of use" secs={TERMS} />}</main>
    </div>
  )
}

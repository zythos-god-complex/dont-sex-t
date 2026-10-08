const seg = typeof Intl !== 'undefined' && 'Segmenter' in Intl ? new Intl.Segmenter(undefined, { granularity: 'grapheme' }) : null
const g = (s: string): string[] => (seg ? [...seg.segment(s)].map((x) => x.segment) : [...s]).filter((x) => x.trim())

export const EMOJI_GROUPS: { name: string; list: string[] }[] = [
  { name: 'faces', list: g('😀😃😄😁😆🥹😅🤣😂🙂🙃😉😊😇🥰😍🤩😘😗😚😙😋😛😜🤪😝🤑🤗🤭🫢🫣🤫🤔🫡🤐🤨😐😑😶🫥😏😒🙄😬😮‍💨🤥😌😔😪🤤😴😷🤒🤕🤢🤮🤧🥵🥶🥴😵🤯🤠🥳🥸😎🤓🧐😕🫤😟🙁😮😯😲😳🥺😦😧😨😰😥😢😭😱😖😣😞😓😩😫🥱😤😡😠🤬😈👿💀☠️💩🤡👹👺👻👽👾🤖') },
  { name: 'hands', list: g('👍👎👌🤌🤏✌️🤞🫰🤟🤘🤙👈👉👆👇☝️👋🤚🖐️✋🖖🫶👏🙌👐🤲🤝🙏💪🫵') },
  { name: 'hearts', list: g('❤️🧡💛💚💙💜🖤🤍🤎💔❤️‍🔥💕💞💓💗💖💘💝💯💢💥💫💦💨🔥✨⭐🌟') },
  { name: 'stuff', list: g('🎉🎊🎈🎁🏆⚽🏀🎮🎧🎤🍕🍔🍟🌮🍩🍪🎂🍿🍺🍻🥂☕🧋🍓🍑🍆🌶️🥑🐸🐶🐱🐵🙈🙉🙊🦄🐍🦋🌈☀️🌙⚡❄️🌸🌹💐🍀👀👑💎💰📸💬💤') },
]

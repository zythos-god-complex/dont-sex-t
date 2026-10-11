// The one inbox people can reach us at: policies, appeals, legal and copyright notices.
export const CONTACT_EMAIL = 'admin@strangers.cafe'
export const mailto = (subject: string) => `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(subject)}`

// Contact details for Optiq Studio Enterprise.
//
// This is a plain (NON-"use client") module on purpose: the enterprise page is
// a Server Component, and importing a data constant from a "use client" module
// hands the server a client-reference proxy instead of the real object — so
// `CONTACT.emails[0]` reads as undefined and the prerender crashes. Keeping the
// data here lets both the server page and the client dialog import the real value.

export const CONTACT = {
  emails: ["optiq@davelabs.co", "sales@davelabs.co"],
  phoneDisplay: "+220 781 0880",
  phoneHref: "tel:+2207810880",
  whatsappHref: "https://wa.me/2207810880",
  mailSubject: "?subject=Optiq%20Studio%20Enterprise%20project",
};

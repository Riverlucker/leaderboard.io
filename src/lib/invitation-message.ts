export function invitationMessage(name:string,url:string,competitionName?:string,competitionSlug?:string) {
  const firstName=name.split(" ")[0]
  const occasion=competitionName === "Ryder Cup" ? " für den Ryder Cup" : competitionName ? ` für „${competitionName}“` : ""
  const agenda=competitionSlug ? `\n\nAlle relevanten Infos ${competitionName === "Ryder Cup" ? "zum Ryder Cup" : `zu „${competitionName || "deinem Wettbewerb"}“`} findest du hier:\nhttps://leaderboard.sc/?comp=${encodeURIComponent(competitionSlug)}&tab=agenda` : ""
  return `Hallo ${firstName},\nwillkommen auf Leaderboard.sc! ⛳\n\nBitte vervollständige dein Profil${occasion} mit deiner E-Mail-Adresse und einem persönlichen Passwort. Wenn du möchtest, ergänze auch ein Profilfoto:\n${url}\n\nDer persönliche Einrichtungslink ist 14 Tage gültig und wird erst beim Speichern verbraucht. Später kannst du dich mit deiner E-Mail-Adresse und deinem Passwort anmelden.${agenda}`
}

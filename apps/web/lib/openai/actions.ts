export async function getHoroscope({ name, sign }: { sign: string, name: string, sex?: string }) {
  return `${sign} Next Tuesday you will befriend a baby otter. Good luck, ${name}!` ;
}
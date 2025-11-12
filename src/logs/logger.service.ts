export default {
  info: (msg: string) => console.log(`INFO: ${msg}`),
  error: (msg: string) => console.error(`ERROR: ${msg}`),
  warn: (msg: string) => console.warn(`WARN: ${msg}`),
  debug: (msg: string) => console.debug(`DEBUG: ${msg}`),
  log: (level: string, msg: string) => console.log(`${level.toUpperCase()}: ${msg}`)
};
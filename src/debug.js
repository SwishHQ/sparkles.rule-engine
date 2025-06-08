function createDebug () {
  try {
    if ((typeof process !== 'undefined' && process.env && process.env.DEBUG && process.env.DEBUG.match(/rule-engine/)) ||
      (typeof window !== 'undefined' && window.localStorage && window.localStorage.debug && window.localStorage.debug.match(/rule-engine/))) {
      return console.debug.bind(console)
    }
  } catch (ex) {
  }
  return () => { }
}
export default createDebug()

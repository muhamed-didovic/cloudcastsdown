import ora from "ora";

function hasOwn (o: { isLogger: boolean; }, prop: PropertyKey) {
    return Object.prototype.hasOwnProperty.call(o, prop)
}

function returnNullObj () {
    return {}
}

/**
 * @param {import('ora').Options & {disabled: boolean}} opts
 * @returns {import('ora').Ora}
 */
const createLogger = (opts = {}) => new Proxy({ isLogger: true }, {
    get (target, prop: PropertyKey) {
        if (hasOwn(target, prop)) return Reflect.get(target, prop)
        if ((opts as {disabled?: boolean}).disabled) return returnNullObj
        const o = ora(opts)
        if (prop === 'promise') {
            return (p: Promise<any>, text: string | undefined) => {
                const spin = o.start(text)
                return p.then(
                    (v: any) => (spin.succeed(text + '  completed.'), v),
                    (err: any) => (spin.fail(text + '  failed!'), Promise.reject(err))
                )
            }
        }
        return typeof o[prop] === 'function' ? o[prop].bind(o) : o[prop]
    }
})

export default createLogger;

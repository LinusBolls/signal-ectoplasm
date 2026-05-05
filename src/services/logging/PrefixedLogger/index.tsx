import { LoggerType } from "../logging.types"

/**
 * prepends `prefix` to console logging statements.
 * 
 * ```ts
 * const plasmLogger = new PrefixedLogger("[plasm]")
 * 
 * plasmLogger.info("test") // "[plasm] test"
 * ```
 */
export class PrefixedLogger implements LoggerType {

    prefix: string

    constructor(prefix: string) {

        this.prefix = prefix
    }
    fatal(...args: unknown[]) {
        console.error(this.prefix, ...args)
    }
    error(...args: unknown[]) {
        console.error(this.prefix, ...args)
    }
    warn(...args: unknown[]) {
        console.warn(this.prefix, ...args)
    }
    info(...args: unknown[]) {
        console.info(this.prefix, ...args)
    }
    debug(...args: unknown[]) {
        console.debug(this.prefix, ...args)
    }
    trace(...args: unknown[]) {
        console.log(this.prefix, ...args)
    }
}
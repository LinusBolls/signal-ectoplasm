export interface SignalHistoryClientSqliteError {
    id: string
    message: string
    mightBeSolvedByRetry: boolean
}

const SqliteError: Record<string, SignalHistoryClientSqliteError> = {

    /**
     * SQLITE_NOTADB is often caused by the signal desktop app currently interacting with db.sqlite,
     * blocking the query we want to execute.
     * we just let it finish its business and try again after a bit.
     */
    SQLITE_NOTADB: {
        id: "SQLITE_NOTADB",
        message: "SQLITE_NOTADB: file is not a database",
        mightBeSolvedByRetry: true,
    },
    SQLITE_NOMEM: {
        id: "SQLITE_NOMEM",
        message: "SQLITE_NOMEM: out of memory",
        mightBeSolvedByRetry: false,
    },
    SQLITE_MISUSE: {
        id: "SQLITE_MISUSE",
        message: "SQLITE_MISUSE: Database is closed",
        mightBeSolvedByRetry: false,
    },
    UNKNOWN: {
        id: "UNKNOWN",
        message: "Unknown sqlite error",
        mightBeSolvedByRetry: false,
    },
    SQLITE_CORRUPT: {
        id: "SQLITE_CORRUPT",
        message: `SQLITE_CORRUPT: malformed database schema (messages_on_insert_insert_mentions) - near ">>": syntax error`,
        mightBeSolvedByRetry: false,
    },
}
export default SqliteError

export const identifySqliteError = (err: Error): SignalHistoryClientSqliteError => {

    const errMessage = err.message

    const messageMatch = Object.values(SqliteError).filter(i => i.message === errMessage)[0]

    if (messageMatch) return messageMatch

    // this should not happen, ideally we know all errors that can possibly occur in our app ^^
    return {
        id: errMessage,
        message: errMessage,
        mightBeSolvedByRetry: false,
    }
}
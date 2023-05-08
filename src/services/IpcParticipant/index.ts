/**
 * responsible for maintaining type-safety for our ipc connection.
 * 
 * TODO: go all in for a react-query or trpc-like solution with methods instead of
 * query keys
 * 
 * TODO: implement errors more deeply in the system
 */

import { Channels } from "main/preload";
import { useEffect, useRef, useState } from "react";
import { MessageWithOptions } from "services/SignalHistoryClient";
import { Conversation } from "services/SignalHistoryClient/signal.types"

type IpcRenderer = {
    sendMessage(channel: Channels, args: unknown[]): void;
    on(channel: Channels, func: (...args: unknown[]) => void): () => void;
    once(channel: Channels, func: (...args: unknown[]) => void): void;
}

export interface Message {

    GET_ALL_MESSAGES_BY_CONVERSATION: {
        renderer: {
            conversationId: string
        }
        main: {
            err: null
            messages: MessageWithOptions<{
                includeMemberInfo: true;
                parseJson: true;
            }>[]
        }
    }
    GET_DASHBOARD_DATA: {
        renderer: {}
        main: {
            err: null
            conversations: Conversation[]
            clientInfo: {
                deviceName: string
                phoneNr: string
                userId: string
                avatarUrl: string
            }
        }
    }
}

export class IpcMainParticipant {
    private ipcMain: Electron.IpcMain

    constructor(ipcMain: Electron.IpcMain) {
        this.ipcMain = ipcMain
    }
    on<T extends keyof Message>(key: T, listener: (event: Electron.IpcMainEvent, arg: Message[T]["renderer"]) => void) {
        console.info("[ipc][main] listening for", key + ":RENDERER")

        this.ipcMain.on(key + ":RENDERER", listener)
    }
    emit<T extends keyof Message>(key: T, data: Message[T]["main"]) {
        console.info("[ipc][main] emitting", key + ":MAIN")

        this.ipcMain.emit(key + ":MAIN", data)
    }
    respond<T extends keyof Message>(key: T, listener: (event: Electron.IpcMainEvent, arg: Message[T]["renderer"]) => Message[T]["main"] | Promise<Message[T]["main"]>) {
        console.info("[ipc][main] listening for", key + ":RENDERER")

        this.ipcMain.on(key + ":RENDERER", async (event, arg) => {

            const res = await listener(event, arg)

            event.reply("GET_DASHBOARD_DATA:MAIN", res)
        })
    }
}

export class IpcRendererParticipant {
    private ipcRenderer: IpcRenderer

    constructor(ipcRenderer: IpcRenderer) {
        this.ipcRenderer = ipcRenderer
    }
    on<T extends keyof Message>(key: T, listener: (event: Electron.IpcMainEvent, arg: Message[T]["main"]) => void) {
        console.info("[ipc][renderer] listening for", key + ":MAIN")
        // @ts-ignore
        this.ipcRenderer.on(key + ":MAIN", listener)
    }
    once<T extends keyof Message>(key: T, listener: (arg: Message[T]["main"]) => void) {
        console.info("[ipc][renderer] listening for", key + ":MAIN", "once")
        // @ts-ignore
        this.ipcRenderer.once(key + ":MAIN", listener)
    }
    emit<T extends keyof Message>(key: T, data: Message[T]["renderer"] = {}) {
        console.info("[ipc][renderer] emitting", key + ":RENDERER")
        // @ts-ignore
        this.ipcRenderer.sendMessage(key + ":RENDERER", data)
    }
    request<T extends keyof Message>(key: T, data: Message[T]["renderer"] = {}): Promise<Message[T]["main"]> {

        return new Promise(async (resolve, reject) => {

            this.once(key, (arg) => {

                resolve(arg)
            })
            this.emit(key, data)
        })
    }
}
export function useIpcQuery<T extends keyof Message>(key: T, data: Message[T]["renderer"] = {}) {

    const ipcParticipant = useRef<IpcRendererParticipant | null>(null)

    const [queryResult, setQueryResult] = useState<Message[T]["main"] | null>(null)

    const isLoadingQueryResult = queryResult == null

    useEffect(() => {

        ipcParticipant.current = new IpcRendererParticipant(window.electron.ipcRenderer);
    
        (async () => {
    
          const res = await ipcParticipant.current!.request(key, data)

          setQueryResult(res)
        })()
      }, [])

    if (isLoadingQueryResult) return {
        data: queryResult,
        isLoading: true,
    } as const

    return {
        data: queryResult,
        isLoading: false,
    } as const
}
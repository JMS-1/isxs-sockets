declare module '@jms-1/isxs-sockets' {
    import { Action } from 'redux'

    const enum socketActions {
        setSessionUser = 'de.inSynergie.library.set-session-user',
    }

    interface ISetSessionUser extends Action {
        token: string
        type: socketActions.setSessionUser
    }

    interface IRequestResponseIndication {
        correlationId: string
    }

    class WebSocketClient {
        static readonly RECONNECT_ACTION_TYPE: string

        readonly endpoint: string

        constructor(
            endpoint: string,
            dispatch?: (client: WebSocketClient, request: Action) => void,
            bearerFactory?: () => Promise<string>,
            onStateChange?: (connected: boolean) => void
        )

        destroy(): void

        connect(): Promise<void>

        sendIndication(request: any): void

        sendRequest<TResponseType>(request: any): Promise<TResponseType>

        bearerFactory?(): Promise<string>
    }
}

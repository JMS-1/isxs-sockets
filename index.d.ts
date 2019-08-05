/// <reference path="server.d.ts" />

declare module '@jms-1/isxs-sockets' {
    import { Action } from 'redux'

    const enum socketActions {
        setSessionUser = 'de.inSynergie.library.set-session-user',
    }

    interface ISetSessionUser extends Action {
        token: string
        type: socketActions.setSessionUser
    }

    interface IOrderedResponse extends Action {
        actionOrder: number
    }

    interface IRequestResponseIndication {
        correlationId: string
    }

    interface IWebSocketClient {
        close(): void
        readonly remoteAddress: string
        send<TResponseType>(response: TResponseType): Promise<void>
    }

    interface IClientSession extends IWebSocketClient {}

    interface ISessionManager {
        filter(predicate?: (session: IClientSession) => boolean): IClientSession[]
    }

    interface IWebSocketConnectorFactory<TImplementation> {
        new (endPoint: string, sessionManager: ISessionManager, bearerFactory: () => Promise<string>): TImplementation
    }
}

declare module '@jms-1/isxs-sockets/server' {
    import { Action } from 'redux'

    import { ISessionManager, IWebSocketConnectorFactory, IClientSession } from '@jms-1/isxs-sockets'

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

    abstract class WebSocketConnector {
        protected constructor(
            endPoint: string,
            sessionManager: ISessionManager,
            bearerFactory: () => Promise<string>,
            onStateChange?: (connected: boolean) => void
        )

        protected readonly endPoint: string

        protected readonly bearerFactory: () => Promise<string>

        broadcast<TIndicationType extends Action>(
            factory: TIndicationType | ((session: IClientSession) => TIndicationType)
        ): void

        protected register<TActionType extends Action>(
            type: TActionType['type'],
            processor: (action: TActionType) => void,
            ordered?: boolean
        ): void

        sendIndication(request: any): void

        sendRequest<TResponseType>(request: any): Promise<TResponseType>

        protected onReconnect(connection: WebSocketClient): void

        protected destroy(): void

        protected connect(): void
    }

    function createWebSocketConnector<TImplementation extends WebSocketConnector>(
        factory: IWebSocketConnectorFactory<TImplementation>,
        endPoint: string,
        sessionManager: ISessionManager,
        bearerFactory: () => Promise<string>
    ): TImplementation
}

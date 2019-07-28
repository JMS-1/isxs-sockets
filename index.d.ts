import { Action } from 'redux'

export const enum socketActions {
    setSessionUser = 'de.inSynergie.library.set-session-user',
}

export interface ISetSessionUser extends Action {
    token: string
    type: socketActions.setSessionUser
}

export interface IOrderedResponse extends Action {
    actionOrder: number
}

export interface IRequestResponseIndication {
    correlationId: string
}

export interface IWebSocketClient {
    close(): void
    readonly remoteAddress: string
    send<TResponseType>(response: TResponseType): Promise<void>
}

export interface IClientSession extends IWebSocketClient {}

export interface ISessionManager {
    filter(predicate?: (session: IClientSession) => boolean): IClientSession[]
}

export interface IWebSocketConnectorFactory<TImplementation> {
    new (endPoint: string, sessionManager: ISessionManager, bearerFactory: () => Promise<string>): TImplementation
}

export class WebSocketClient {
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

export abstract class WebSocketConnector {
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

export function createWebSocketConnector<TImplementation extends WebSocketConnector>(
    factory: IWebSocketConnectorFactory<TImplementation>,
    endPoint: string,
    sessionManager: ISessionManager,
    bearerFactory: () => Promise<string>
): TImplementation

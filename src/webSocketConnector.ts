import * as debug from 'debug'
import { Action } from 'redux'

import * as sockets from '../index'
import { WebSocketClient } from './webSocketCaller'

const trace = debug('sessions:trace')

type IOptionalOrder = Partial<sockets.IOrderedResponse & sockets.IRequestResponseIndication>

interface IActionInfo {
    callback: (action: Action) => void
    ordered: boolean
}

export abstract class WebSocketConnector {
    private _remote: WebSocketClient

    private readonly _dispatch: { [type: string]: IActionInfo } = {}

    private _lastSequence: number

    protected constructor(
        endPoint: string,
        private readonly _sessionManager: sockets.ISessionManager,
        bearerFactory: () => Promise<string>,
        onStateChange?: (connected: boolean) => void
    ) {
        this._remote = new WebSocketClient(endPoint, this.dispatch, bearerFactory, onStateChange)
    }

    protected get endPoint(): string {
        return this._remote && this._remote.endpoint
    }

    protected get bearerFactory(): () => Promise<string> {
        return this._remote && this._remote.bearerFactory
    }

    broadcast = <TIndicationType extends Action>(
        factory: TIndicationType | ((session: sockets.IClientSession) => TIndicationType)
    ) => {
        for (let session of this._sessionManager.filter()) {
            try {
                const indication = typeof factory === 'function' ? factory(session) : factory

                if (indication) {
                    session.send(indication)
                }
            } catch (e) {
                //TODO tba
            }
        }
    }

    protected register<TActionType extends Action>(
        type: TActionType['type'],
        processor: (action: TActionType) => void,
        ordered: boolean = false
    ): void {
        this._dispatch[type] = { callback: processor, ordered }
    }

    sendIndication(request: any): void {
        this._remote.sendIndication(request)
    }

    sendRequest<TResponseType>(request: any): Promise<TResponseType> {
        return this._remote.sendRequest<TResponseType>(request)
    }

    protected onReconnect(connection: WebSocketClient): void {
        // to be implemented
    }

    protected destroy(): void {
        const connection = this._remote

        if (connection) {
            delete this._remote

            connection.destroy()
        }
    }

    protected connect(): void {
        this._remote.connect()
    }

    private dispatch = (client: WebSocketClient, request: Action) => {
        if (request.type === WebSocketClient.RECONNECT_ACTION_TYPE) {
            this._lastSequence = undefined

            this.onReconnect(client)
        }

        const orderedAction = request as IOptionalOrder
        const isOrderedAction = typeof orderedAction.actionOrder === 'number'
        const isValidOrderedAction =
            isOrderedAction && (this._lastSequence === undefined || orderedAction.actionOrder > this._lastSequence)

        if (isValidOrderedAction) {
            this._lastSequence = orderedAction.actionOrder
        }

        const processor = this._dispatch[`${request.type}`]

        if (!processor || !processor.callback) {
            return
        }

        if (processor.ordered && !isValidOrderedAction) {
            trace(
                "outdated action '%s' received: %i must be greater than %i",
                request.type,
                orderedAction.actionOrder,
                this._lastSequence
            )

            if (!orderedAction.correlationId) {
                return
            }

            trace('force processing since request / response pattern is used')
        }

        processor.callback(request)
    }
}

export function createWebSocketConnector<TImplementation extends WebSocketConnector>(
    factory: sockets.IWebSocketConnectorFactory<TImplementation>,
    endPoint: string,
    sessionManager: sockets.ISessionManager,
    bearerFactory: () => Promise<string>
): TImplementation {
    const connector = new factory(endPoint, sessionManager, bearerFactory)

    return connector
}

import * as debug from 'debug'
import { Action } from 'redux'
import { v4 as uuid } from 'uuid'
import { client, connection } from 'websocket'

import { IRequestResponseIndication, ISetSessionUser, socketActions } from '@jms-1/isxs-sockets'
import { getMessage } from '@jms-1/isxs-tools'

const toolError = debug('webTools')
const toolTrace = debug('webTools:trace')

// Verwaltet eine dauerhaft Verbindung zu einem Web Socket API Server.
export class WebSocketClient {
    // Diese Aktion wird bei jedem erneuten Herstellen der Verbindung als erstes gemeldelt.
    static readonly RECONNECT_ACTION_TYPE = 'de.inSynergie.library.websocket-connected'

    // Alle ausstehenden Verbindungen.
    private readonly _pending: { [id: string]: (response: any) => void } = {}

    // Asynchroner Zugriff auf eine Web Socket Verbindung.
    private _loader: Promise<connection>

    private _mayConnect = true

    private _client: client

    private _lastReport = Date.now()

    constructor(
        readonly endpoint: string,
        private _dispatch?: (client: WebSocketClient, request: Action) => void,
        readonly bearerFactory?: () => Promise<string>,
        private readonly _onStateChange?: (connected: boolean) => void
    ) {
        toolTrace('creating new Web Socket Client Manager to %s', this.endpoint)
    }

    // Fehlerbehandlung.
    private connectFailed(): void {
        // Maximal eine Meldung pro Minute.
        const now = Date.now()
        const report = now - this._lastReport

        if (report < 60000) {
            return
        }

        this._lastReport = now

        toolError('Web Socket Endpoint %s not available', this.endpoint)
    }

    // Erneuter Verbindungsaufbau.
    private reconnect(): void {
        // Melden.
        if (this._onStateChange) {
            this._onStateChange(false)
        }

        // Verbindung entfernen.
        const api = this._client

        if (api) {
            delete this._client

            try {
                // Das sollte den Kanal endgültig schliessen.
                api.removeAllListeners()
                api.socket.destroy()
            } catch (e) {
                //TODO
            }
        }

        // Nanu, da sind wir schon mal gewesen.
        if (!this._loader) {
            return
        }

        // Verbindung entfernen.
        delete this._loader

        // Später noch einmal probieren.
        if (this._mayConnect) {
            setTimeout(this.connect, 5000)
        }
    }

    destroy(): void {
        if (this._mayConnect) {
            this._mayConnect = false

            this.reconnect()
        }
    }

    // Verbindungsaufbau mit Retry.
    readonly connect = async (): Promise<void> => {
        try {
            // Alles schon erledigt.
            if (this._loader || !this._mayConnect) {
                return
            }

            // Promise erstellen.
            let promise: { success: (connection: connection) => void; failure: (err: any) => void }

            this._loader = new Promise<connection>((success, failure) => (promise = { success, failure }))

            // Die Verbindungsverwaltung anlegen.
            toolTrace('open new Web Socket Client to %s', this.endpoint)

            const api = new client()

            // Fertig stellen.
            api.on('connect', async connection => {
                // Müssen wir wohl demnächst neu aufbauen.
                connection.on('error', err => {
                    toolError('Web Socket Client error on %s', this.endpoint)
                    this.reconnect()
                })

                connection.on('close', (code, desc) => {
                    toolTrace('Web Socket Client connection to %s closed', this.endpoint)
                    this.reconnect()
                })

                // Autorisierung.
                if (this.bearerFactory) {
                    try {
                        const setUser: ISetSessionUser = {
                            token: await this.bearerFactory(),
                            type: socketActions.setSessionUser,
                        }

                        // Anmelden.
                        if (setUser) {
                            connection.sendUTF(JSON.stringify(setUser))
                        }
                    } catch (error) {
                        toolError('unable to set user: %s', getMessage(error))
                    }
                }

                // Melden.
                if (this._onStateChange) {
                    this._onStateChange(true)
                }

                // Da sagen wir erst einmal Bescheid.
                if (this._dispatch) {
                    this._dispatch(this, { type: WebSocketClient.RECONNECT_ACTION_TYPE })
                }

                // Hier werden die Antworten verarbeitet.
                connection.on('message', data => {
                    toolTrace('got Web Socket response on %s', this.endpoint)

                    // Decodieren und Nachschlagen.
                    const resp: IRequestResponseIndication & Action = JSON.parse(data.utf8Data)
                    const client = this._pending[resp.correlationId || '']

                    // Auswerten.
                    if (client) {
                        // Das machen wir nur einmal.
                        delete this._pending[resp.correlationId]

                        // Und ab.
                        client(resp)
                    }

                    // Und verteilen.
                    if (this._dispatch) {
                        this._dispatch(this, resp)
                    }
                })

                // Ab jetzt dürfen wir die benutzen.
                promise.success(connection)
            })

            // Fehler.
            api.on('connectFailed', err => {
                this.connectFailed()
                this.reconnect()
            })

            // Verbindung herstellen.
            api.connect(this.endpoint)

            // Merken.
            this._client = api
        } catch (e) {
            this.reconnect()
        }
    }

    // Daten senden.
    sendIndication(request: any): void {
        toolTrace('will send Web Socket indication to %s', this.endpoint)

        this.connect()
            .then(async () => {
                const conn = this._loader && (await this._loader)

                if (conn) {
                    try {
                        conn.sendUTF(JSON.stringify(request))
                    } catch (e) {
                        toolError('Unable to send on %s: %s', this.endpoint, getMessage(e))
                    }
                } else {
                    toolError('Web Socket Endpoint %s can not be used', this.endpoint)
                }
            })
            .catch(e => toolError('unable to send indication on %s: %s', this.endpoint, getMessage(e)))
    }

    sendRequest<TResponseType>(request: any): Promise<TResponseType> {
        toolTrace('will send Web Socket request to %s', this.endpoint)

        return new Promise<TResponseType>(async (success, failure) => {
            try {
                // Verbinden.
                await this.connect()

                // Ups, das war wohl nix.
                const conn = this._loader && (await this._loader)

                if (!conn) {
                    toolError('Web Socket Endpoint %s can not be used', this.endpoint)

                    failure('not connected')
                } else {
                    // Anfrage erweitern.
                    const withId: IRequestResponseIndication = { ...request, correlationId: uuid() }

                    // Merken.
                    this._pending[withId.correlationId] = success

                    // Senden.
                    conn.sendUTF(JSON.stringify(withId))
                }
            } catch (e) {
                failure(e)
            }
        })
    }
}

/**
 * Sumber data langsung dari broker MQTT (lewat WebSocket — browser tidak bisa TCP 1883).
 * Broker perlu listener WebSocket, mis. Mosquitto:  listener 9001 / protocol websockets
 * Telemetri 100 Hz di-throttle ke 10 Hz untuk tampilan; getaran dihitung dari semua sampel.
 */
import mqtt, { type MqttClient } from 'mqtt';
import { CONFIG } from '../config';
import { topics, type AppSettings } from '../settings';
import { parseJson, toControl, toEvent, toPrediction, toSeat, toTelemetry, VibrationWindow } from './normalize';
import type { DataSink, DataSource } from './source';

export function mqttOptions(s: AppSettings) {
  return {
    username: s.mqtt.username || undefined,
    password: s.mqtt.password || undefined,
    clientId: s.mqtt.clientId || `sw-dash-${Math.random().toString(16).slice(2, 10)}`,
    connectTimeout: 5000,
    reconnectPeriod: 3000,
    clean: true,
  };
}

export class MqttSource implements DataSource {
  readonly kind = 'mqtt' as const;
  private client: MqttClient | null = null;
  private vib = new VibrationWindow();
  private lastEmit = 0;

  constructor(private settings: AppSettings) {}

  start(sink: DataSink) {
    const s = this.settings;
    const t = topics(s.mqtt.topicPrefix);
    sink.connection({ mqtt: false, firebase: false, source: 'mqtt' });
    sink.modelInfo(null);

    let client: MqttClient;
    try {
      client = mqtt.connect(s.mqtt.url, mqttOptions(s));
    } catch (e) {
      sink.connection({ mqtt: false, firebase: false, source: 'mqtt', error: String(e) });
      return;
    }
    this.client = client;

    client.on('connect', () => {
      sink.connection({ mqtt: true, firebase: false, source: 'mqtt' });
      client.subscribe([t.telemetry, t.prediction, t.control, t.seat, t.events]);
      sink.event(toEvent({ type: 'MQTT_CONNECTED', severity: 'info', message: `Terhubung ke ${s.mqtt.url}` }));
    });
    client.on('reconnect', () => sink.connection({ mqtt: false, firebase: false, source: 'mqtt', error: 'Mencoba menyambung ulang…' }));
    client.on('close', () => sink.connection({ mqtt: false, firebase: false, source: 'mqtt', error: 'Koneksi broker tertutup' }));
    client.on('error', (err) => sink.connection({ mqtt: false, firebase: false, source: 'mqtt', error: err.message }));

    client.on('message', (topic, payload) => {
      const r = parseJson(payload);
      if (!r) return;
      if (topic === t.telemetry) {
        const tel = toTelemetry(r, s.deviceId, this.vib);
        const now = performance.now();
        if (now - this.lastEmit >= 1000 / CONFIG.displayHz) {
          this.lastEmit = now;
          sink.telemetry(tel);
        }
      } else if (topic === t.prediction) {
        const p = toPrediction(r);
        if (p) sink.prediction(p);
      } else if (topic === t.control) sink.control(toControl(r));
      else if (topic === t.seat) sink.seat(toSeat(r));
      else if (topic === t.events) sink.event(toEvent(r));
    });
  }

  stop() {
    this.client?.end(true);
    this.client = null;
  }
}

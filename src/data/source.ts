import type {
  ConnectionStatus, ControlStatus, DeviceEvent, ModelInfo, Prediction, SeatStatus, Telemetry,
} from '../types/contract';

/** Semua sumber data (simulator, Firebase) mendorong data lewat sink ini. */
export interface DataSink {
  telemetry(t: Telemetry): void;
  prediction(p: Prediction): void;
  control(c: ControlStatus): void;
  seat(s: SeatStatus): void;
  event(e: DeviceEvent): void;
  connection(c: ConnectionStatus): void;
  modelInfo(m: ModelInfo | null): void;
}

export interface DataSource {
  readonly kind: 'simulator' | 'firebase';
  start(sink: DataSink): void;
  stop(): void;
}

/*instrumentation.mjs*/
import { NodeSDK } from '@opentelemetry/sdk-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-grpc';
import { OTLPLogExporter } from '@opentelemetry/exporter-logs-otlp-grpc';
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-grpc';
import { BatchLogRecordProcessor } from '@opentelemetry/sdk-logs';
import { PeriodicExportingMetricReader } from '@opentelemetry/sdk-metrics';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { credentials } from '@grpc/grpc-js';
import { readFileSync } from 'fs';
import { RuntimeNodeInstrumentation } from '@opentelemetry/instrumentation-runtime-node';

// Setup gRPC credentials with TLS
let grpcCredentials = credentials.createInsecure();
let exporterOptions = { credentials: grpcCredentials };

if (process.env.OTEL_EXPORTER_OTLP_CA_CERTIFICATE) {
    try {
        const caCert = readFileSync(process.env.OTEL_EXPORTER_OTLP_CA_CERTIFICATE);
        grpcCredentials = credentials.createSsl(caCert);
        exporterOptions = { credentials: grpcCredentials };
    } catch (err) {
        console.error('[OTEL] Failed to read CA certificate:', err.message);
        exporterOptions = { credentials: credentials.createInsecure() };
    }
}

// Initialize OpenTelemetry SDK
const sdk = new NodeSDK({
    traceExporter: new OTLPTraceExporter(exporterOptions),
    logRecordProcessor: new BatchLogRecordProcessor(
        new OTLPLogExporter(exporterOptions)
    ),
    metricReader: new PeriodicExportingMetricReader({
        exporter: new OTLPMetricExporter(exporterOptions),
        exportIntervalMillis: 60000,
    }),
    instrumentations: [getNodeAutoInstrumentations({
        '@opentelemetry/instrumentation-aws-sdk': { enabled: false },
        '@opentelemetry/instrumentation-http': {
            enabled: true
        }
    }),
        new RuntimeNodeInstrumentation({
            enabled: true,
            exportFloats: true,
            memory: { enabled: true },
            cpu: { enabled: true },
            eventLoop: { enabled: true },
        })],
});

// Start SDK
sdk.start();
console.log('[OTEL] OpenTelemetry initialized');

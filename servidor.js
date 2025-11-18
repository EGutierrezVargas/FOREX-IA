const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const { analisisConIA } = require('./analisis-con-ia');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

const PORT = 3000;

// Servir archivos estáticos
app.use(express.static('public'));

// Ruta principal
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Configuración del monitoreo
const CONFIG = {
  symbols: ['USD/JPY', 'EUR/USD', 'GBP/USD'],
  interval: '5min',
  checkInterval: 300000 // 5 minuto
}

let contadorRevisiones = 0;
let ultimosResultados = {};

// Función de análisis que envía datos a los clientes conectados
async function ejecutarAnalisis() {
    contadorRevisiones++;
    const timestamp = new Date().toISOString();
    
    console.log(`\n📊 Revisión #${contadorRevisiones} - ${new Date().toLocaleString('es-ES')}`);
    
    for (const symbol of CONFIG.symbols) {
        try {
            console.log(`   Analizando ${symbol}...`);
            const resultado = await analisisConIA(symbol, CONFIG.interval);
            
            // Guardar resultado
            ultimosResultados[symbol] = {
                ...resultado,
                timestamp: timestamp,
                revision: contadorRevisiones
            };
            
            // Enviar a todos los clientes conectados
            io.emit('analisis-actualizado', {
                symbol: symbol,
                data: ultimosResultados[symbol]
            });
            
            // Enviar alerta si es señal fuerte
            if (Math.abs(resultado.puntuacionFinal) >= 3) {
                io.emit('alerta-fuerte', {
                    symbol: symbol,
                    data: resultado
                });
                console.log(`   🚨 ALERTA FUERTE: ${symbol} - ${resultado.decision}`);
            }
            
        } catch (error) {
            console.error(`   ❌ Error con ${symbol}:`, error.message);
        }
    }
    
    // Enviar resumen
    io.emit('resumen', {
        revision: contadorRevisiones,
        timestamp: timestamp,
        resultados: ultimosResultados
    });
}

// WebSocket: Cuando un cliente se conecta
io.on('connection', (socket) => {
    console.log('✅ Cliente conectado:', socket.id);
    
    // Enviar configuración actual
    socket.emit('config', CONFIG);
    
    // Enviar últimos resultados si existen
    if (Object.keys(ultimosResultados).length > 0) {
        socket.emit('resumen', {
            revision: contadorRevisiones,
            timestamp: new Date().toISOString(),
            resultados: ultimosResultados
        });
    }
    
    socket.on('disconnect', () => {
        console.log('❌ Cliente desconectado:', socket.id);
    });
    
    // Permitir solicitud de análisis manual
    socket.on('solicitar-analisis', async (symbol) => {
        console.log(`📊 Análisis manual solicitado para ${symbol}`);
        try {
            const resultado = await analisisConIA(symbol, CONFIG.interval);
            socket.emit('analisis-actualizado', {
                symbol: symbol,
                data: resultado
            });
        } catch (error) {
            socket.emit('error', { symbol, message: error.message });
        }
    });
});

// Iniciar servidor
server.listen(PORT, () => {
    console.log('═'.repeat(70));
    console.log('🚀 SERVIDOR DE ANÁLISIS FOREX CON IA');
    console.log('═'.repeat(70));
    console.log(`🌐 Servidor corriendo en: http://localhost:${PORT}`);
    console.log(`📊 Monitoreando: ${CONFIG.symbols.join(', ')}`);
    console.log(`⏱️  Intervalo: ${CONFIG.checkInterval/1000} segundos`);
    console.log('═'.repeat(70));
    console.log('\n✨ Abre tu navegador en http://localhost:3000\n');
    
    // Primera ejecución inmediata
    ejecutarAnalisis();
    
    // Ejecutar periódicamente
    setInterval(ejecutarAnalisis, CONFIG.checkInterval);
});

// Manejo de errores
process.on('uncaughtException', (error) => {
    console.error('❌ Error no capturado:', error);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('❌ Promesa rechazada no manejada:', reason);
});

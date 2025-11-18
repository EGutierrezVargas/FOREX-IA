const axios = require('axios');
const { generarPuntosEntrada } = require('./puntos-entrada-salida');

const API_KEY_TWELVE = 'a27117528e9f4c36a739e148011564c9';

/**
 * Análisis de sentimiento usando Alpha Vantage News API
 * Analiza noticias relacionadas con el par forex
 */
async function analizarSentimientoNoticias(symbol) {
    try {
        // Extraer las monedas del par (ej: USD/JPY -> USD, JPY)
        const [moneda1, moneda2] = symbol.split('/');
        
        console.log(`\n📰 ANÁLISIS DE SENTIMIENTO - NOTICIAS`);
        console.log('─'.repeat(70));
        
        // Buscar noticias relacionadas con las monedas
        const topics = [`${moneda1}_CURRENCY`, `${moneda2}_CURRENCY`, 'FOREX'];
        
        const response = await axios.get('https://www.alphavantage.co/query', {
            params: {
                function: 'NEWS_SENTIMENT',
                tickers: `FOREX:${symbol.replace('/', '')}`,
                apikey: 'D2X4EUZXUQQ1772Y', // Tu API key de Alpha Vantage
                limit: 10
            }
        });
        
        if (response.data.feed && response.data.feed.length > 0) {
            let sentimientoTotal = 0;
            let contadorNoticias = 0;
            
            response.data.feed.forEach(noticia => {
                if (noticia.overall_sentiment_score) {
                    sentimientoTotal += parseFloat(noticia.overall_sentiment_score);
                    contadorNoticias++;
                    
                    const emoji = noticia.overall_sentiment_score > 0.15 ? '🟢' :
                                 noticia.overall_sentiment_score < -0.15 ? '🔴' : '🟡';
                    
                    console.log(`${emoji} ${noticia.title.substring(0, 60)}...`);
                    console.log(`   Sentimiento: ${noticia.overall_sentiment_score} | ${noticia.overall_sentiment_label}`);
                }
            });
            
            const sentimientoPromedio = sentimientoTotal / contadorNoticias;
            
            console.log(`\n📊 Sentimiento promedio: ${sentimientoPromedio.toFixed(3)}`);
            
            let interpretacion = '';
            let señal = 'NEUTRAL';
            let puntos = 0;
            
            if (sentimientoPromedio > 0.15) {
                interpretacion = '🟢 MUY POSITIVO - Favorable para COMPRA';
                señal = 'COMPRA';
                puntos = 3;
            } else if (sentimientoPromedio > 0.05) {
                interpretacion = '🟢 POSITIVO - Ligeramente alcista';
                señal = 'COMPRA';
                puntos = 1;
            } else if (sentimientoPromedio < -0.15) {
                interpretacion = '🔴 MUY NEGATIVO - Favorable para VENTA';
                señal = 'VENTA';
                puntos = 3;
            } else if (sentimientoPromedio < -0.05) {
                interpretacion = '🔴 NEGATIVO - Ligeramente bajista';
                señal = 'VENTA';
                puntos = 1;
            } else {
                interpretacion = '🟡 NEUTRAL - Sin sesgo claro';
                señal = 'NEUTRAL';
                puntos = 0;
            }
            
            console.log(`${interpretacion}\n`);
            
            return {
                sentimiento: sentimientoPromedio,
                señal: señal,
                puntos: puntos,
                noticiasAnalizadas: contadorNoticias
            };
        } else {
            console.log('No hay noticias recientes disponibles\n');
            return { sentimiento: 0, señal: 'NEUTRAL', puntos: 0, noticiasAnalizadas: 0 };
        }
        
    } catch (error) {
        console.log(`⚠️  Error obteniendo noticias: ${error.message}\n`);
        return { sentimiento: 0, señal: 'NEUTRAL', puntos: 0, noticiasAnalizadas: 0 };
    }
}

/**
 * Predicción usando regresión lineal simple
 * Predice el siguiente movimiento basado en tendencia histórica
 */
function predecirMovimiento(precios) {
    const n = precios.length;
    let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
    
    // Regresión lineal: y = mx + b
    for (let i = 0; i < n; i++) {
        sumX += i;
        sumY += precios[i];
        sumXY += i * precios[i];
        sumX2 += i * i;
    }
    
    const pendiente = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    const interseccion = (sumY - pendiente * sumX) / n;
    
    // Predecir siguiente valor
    const siguientePrecio = pendiente * n + interseccion;
    const precioActual = precios[precios.length - 1];
    const cambio = ((siguientePrecio - precioActual) / precioActual) * 100;
    
    // Calcular confianza basada en R²
    let ssRes = 0, ssTot = 0;
    const promedio = sumY / n;
    
    for (let i = 0; i < n; i++) {
        const predicho = pendiente * i + interseccion;
        ssRes += Math.pow(precios[i] - predicho, 2);
        ssTot += Math.pow(precios[i] - promedio, 2);
    }
    
    const r2 = 1 - (ssRes / ssTot);
    const confianza = Math.max(0, Math.min(100, r2 * 100));
    
    return {
        precioPredicho: siguientePrecio,
        cambioEsperado: cambio,
        tendencia: cambio > 0 ? 'ALCISTA' : 'BAJISTA',
        confianza: confianza,
        pendiente: pendiente
    };
}

/**
 * Análisis de volatilidad y momentum
 */
function analizarVolatilidadMomentum(datos) {
    const precios = datos.map(d => parseFloat(d.close));
    const volumenes = datos.map(d => parseFloat(d.volume));
    
    // Calcular cambios porcentuales
    const cambios = [];
    for (let i = 1; i < precios.length; i++) {
        cambios.push((precios[i] - precios[i-1]) / precios[i-1] * 100);
    }
    
    // Volatilidad (desviación estándar)
    const promedioCambios = cambios.reduce((a, b) => a + b, 0) / cambios.length;
    const varianza = cambios.reduce((sum, val) => sum + Math.pow(val - promedioCambios, 2), 0) / cambios.length;
    const volatilidad = Math.sqrt(varianza);
    
    // Momentum (últimos 10 períodos)
    const momentum = precios[precios.length - 1] - precios[precios.length - 10];
    const momentumPorcentaje = (momentum / precios[precios.length - 10]) * 100;
    
    // Volumen promedio vs actual
    const volumenPromedio = volumenes.slice(0, 20).reduce((a, b) => a + b, 0) / 20;
    const volumenActual = volumenes[0];
    const relacionVolumen = volumenActual / volumenPromedio;
    
    return {
        volatilidad: volatilidad,
        momentum: momentumPorcentaje,
        volumenRelativo: relacionVolumen
    };
}

/**
 * Sistema combinado: Análisis Técnico + IA + Sentimiento
 */
async function analisisConIA(symbol = 'USD/JPY', interval = '5min') {
    try {
        console.log('\n🤖 ANÁLISIS AVANZADO CON IA');
        console.log('═'.repeat(70));
        console.log(`Par: ${symbol} | Intervalo: ${interval}`);
        console.log(`Timestamp: ${new Date().toLocaleString('es-ES')}`);
        console.log('═'.repeat(70));
        
        // 1. OBTENER DATOS
        const response = await axios.get('https://api.twelvedata.com/time_series', {
            params: {
                symbol: symbol,
                interval: interval,
                outputsize: 100,
                apikey: API_KEY_TWELVE,
                timezone: 'UTC'
            }
        });
        
        if (response.data.status === 'error') {
            throw new Error(response.data.message);
        }
        
        const datos = response.data.values;
        const precios = datos.map(v => parseFloat(v.close)).reverse();
        const precioActual = precios[precios.length - 1];
        
        // 2. PREDICCIÓN CON IA (REGRESIÓN)
        console.log('\n🔮 PREDICCIÓN CON IA (Machine Learning)');
        console.log('─'.repeat(70));
        
        const prediccion = predecirMovimiento(precios.slice(-50));
        
        console.log(`💰 Precio actual: ${precioActual.toFixed(5)}`);
        console.log(`🎯 Precio predicho: ${prediccion.precioPredicho.toFixed(5)}`);
        console.log(`📊 Cambio esperado: ${prediccion.cambioEsperado > 0 ? '+' : ''}${prediccion.cambioEsperado.toFixed(2)}%`);
        console.log(`📈 Tendencia: ${prediccion.tendencia === 'ALCISTA' ? '🟢' : '🔴'} ${prediccion.tendencia}`);
        console.log(`🎲 Confianza del modelo: ${prediccion.confianza.toFixed(1)}%`);
        
        let puntosIA = 0;
        if (prediccion.confianza > 70) {
            if (prediccion.cambioEsperado > 0.05) {
                puntosIA = 3;
                console.log(`💡 IA recomienda: 🟢🟢🟢 COMPRA FUERTE`);
            } else if (prediccion.cambioEsperado > 0.02) {
                puntosIA = 1;
                console.log(`💡 IA recomienda: 🟢 COMPRA`);
            } else if (prediccion.cambioEsperado < -0.05) {
                puntosIA = -3;
                console.log(`💡 IA recomienda: 🔴🔴🔴 VENTA FUERTE`);
            } else if (prediccion.cambioEsperado < -0.02) {
                puntosIA = -1;
                console.log(`💡 IA recomienda: 🔴 VENTA`);
            } else {
                console.log(`💡 IA recomienda: ⚪ NEUTRAL`);
            }
        } else {
            console.log(`⚠️  Confianza baja - IA no hace recomendación clara`);
        }
        
        // 3. ANÁLISIS DE VOLATILIDAD Y MOMENTUM
        console.log('\n📊 ANÁLISIS DE VOLATILIDAD Y MOMENTUM');
        console.log('─'.repeat(70));
        
        const volatilidad = analizarVolatilidadMomentum(datos.slice(0, 50));
        
        console.log(`📉 Volatilidad: ${volatilidad.volatilidad.toFixed(3)}%`);
        console.log(`⚡ Momentum: ${volatilidad.momentum > 0 ? '+' : ''}${volatilidad.momentum.toFixed(2)}%`);
        console.log(`📊 Volumen relativo: ${(volatilidad.volumenRelativo * 100).toFixed(0)}%`);
        
        let puntosVolatilidad = 0;
        if (volatilidad.momentum > 0.1 && volatilidad.volumenRelativo > 1.2) {
            puntosVolatilidad = 2;
            console.log(`💡 Momentum + Volumen: 🟢 Favorable para COMPRA`);
        } else if (volatilidad.momentum < -0.1 && volatilidad.volumenRelativo > 1.2) {
            puntosVolatilidad = -2;
            console.log(`💡 Momentum + Volumen: 🔴 Favorable para VENTA`);
        }
        
        // 4. SENTIMIENTO DE NOTICIAS
        const sentimiento = await analizarSentimientoNoticias(symbol);
        
        // 5. ANÁLISIS TÉCNICO TRADICIONAL
        console.log('\n📐 ANÁLISIS TÉCNICO TRADICIONAL');
        console.log('─'.repeat(70));
        console.log('Ejecutando análisis de soportes, resistencias y patrones...\n');
        
        const analisisTecnico = await generarPuntosEntrada(symbol, interval);
        
        // 6. PUNTUACIÓN COMBINADA
        console.log('\n' + '═'.repeat(70));
        console.log('🎯 DECISIÓN FINAL - COMBINANDO TODOS LOS ANÁLISIS');
        console.log('═'.repeat(70));
        
        let puntuacionFinal = puntosIA + puntosVolatilidad + (sentimiento.puntos || 0);
        
        console.log(`\n📊 PUNTUACIÓN POR COMPONENTE:`);
        console.log(`   🤖 IA/Machine Learning: ${puntosIA > 0 ? '+' : ''}${puntosIA}`);
        console.log(`   📊 Volatilidad/Momentum: ${puntosVolatilidad > 0 ? '+' : ''}${puntosVolatilidad}`);
        console.log(`   📰 Sentimiento de noticias: ${sentimiento.puntos > 0 ? '+' : ''}${sentimiento.puntos || 0}`);
        console.log(`   ─────────────────────────`);
        console.log(`   ⚖️  PUNTUACIÓN TOTAL: ${puntuacionFinal > 0 ? '+' : ''}${puntuacionFinal}`);
        
        // Determinar señal final
        let decisionFinal = '';
        let confianza = '';
        
        if (puntuacionFinal >= 5) {
            decisionFinal = '🟢🟢🟢 COMPRA MUY FUERTE';
            confianza = 'MUY ALTA';
        } else if (puntuacionFinal >= 3) {
            decisionFinal = '🟢🟢 COMPRA FUERTE';
            confianza = 'ALTA';
        } else if (puntuacionFinal >= 1) {
            decisionFinal = '🟢 COMPRA';
            confianza = 'MEDIA';
        } else if (puntuacionFinal <= -5) {
            decisionFinal = '🔴🔴🔴 VENTA MUY FUERTE';
            confianza = 'MUY ALTA';
        } else if (puntuacionFinal <= -3) {
            decisionFinal = '🔴🔴 VENTA FUERTE';
            confianza = 'ALTA';
        } else if (puntuacionFinal <= -1) {
            decisionFinal = '🔴 VENTA';
            confianza = 'MEDIA';
        } else {
            decisionFinal = '⚪ NEUTRAL - ESPERAR';
            confianza = 'BAJA';
        }
        
        console.log(`\n${decisionFinal}`);
        console.log(`Nivel de confianza: ${confianza}`);
        
        // Mostrar recomendaciones del análisis técnico si existen
        if (analisisTecnico.entrada) {
            console.log(`\n💡 DATOS PARA LA OPERACIÓN:`);
            console.log(`   📍 Precio de entrada: ${analisisTecnico.entrada}`);
            console.log(`   🛑 Stop Loss: ${analisisTecnico.stopLoss}`);
            console.log(`   🎯 Take Profit 1: ${analisisTecnico.takeProfit1} (R/R: 1:${analisisTecnico.ratioRR1})`);
            console.log(`   🎯 Take Profit 2: ${analisisTecnico.takeProfit2} (R/R: 1:${analisisTecnico.ratioRR2})`);
        }
        
        console.log('\n' + '═'.repeat(70));
        
        return {
            symbol,
            precioActual,
            prediccionIA: prediccion,
            sentimiento: sentimiento,
            volatilidad: volatilidad,
            puntuacionFinal,
            decision: decisionFinal,
            confianza: confianza,
            analisisTecnico: analisisTecnico
        };
        
    } catch (error) {
        console.error('❌ Error:', error.message);
        throw error;
    }
}

/**
 * Monitoreo continuo con IA
 */
async function monitoreoConIA(symbols = ['USD/JPY'], interval = '5min', checkIntervalMs = 300000) {
    console.log('🤖 MONITOREO EN TIEMPO REAL CON IA ACTIVADO');
    console.log('═'.repeat(70));
    console.log(`🔥 MODO: TIEMPO REAL`);
    console.log(`Pares: ${symbols.join(', ')}`);
    console.log(`Intervalo de velas: ${interval}`);
    console.log(`Revisión cada: ${checkIntervalMs/1000} segundos`);
    console.log(`⚡ Alertas automáticas cuando puntuación ≥ 3\n`);
    
    let contadorRevisiones = 0;
    let ultimasSeñales = {};
    
    const analizar = async () => {
        contadorRevisiones++;
        const timestamp = new Date().toLocaleString('es-ES', { 
            hour: '2-digit', 
            minute: '2-digit', 
            second: '2-digit' 
        });
        
        console.log('\n\n' + '█'.repeat(70));
        console.log(`🕐 REVISIÓN #${contadorRevisiones} - ${timestamp}`);
        console.log('█'.repeat(70));
        
        for (const symbol of symbols) {
            try {
                const resultado = await analisisConIA(symbol, interval);
                
                // Guardar última señal
                const señalAnterior = ultimasSeñales[symbol];
                ultimasSeñales[symbol] = resultado.decision;
                
                // 🚨 ALERTA FUERTE
                if (Math.abs(resultado.puntuacionFinal) >= 3) {
                    console.log('\n' + '🚨'.repeat(35));
                    console.log('🚨🚨🚨 ¡¡¡ALERTA!!! SEÑAL FUERTE DETECTADA 🚨🚨🚨');
                    console.log('🚨'.repeat(35));
                    console.log(`📊 PAR: ${symbol}`);
                    console.log(`⚡ SEÑAL: ${resultado.decision}`);
                    console.log(`💪 PUNTUACIÓN: ${resultado.puntuacionFinal}`);
                    console.log(`🎯 CONFIANZA: ${resultado.confianza}`);
                    
                    if (resultado.analisisTecnico.entrada) {
                        console.log(`\n💰 ACCIÓN INMEDIATA:`);
                        console.log(`   📍 ENTRAR EN: ${resultado.analisisTecnico.entrada}`);
                        console.log(`   🛑 STOP LOSS: ${resultado.analisisTecnico.stopLoss}`);
                        console.log(`   🎯 OBJETIVO 1: ${resultado.analisisTecnico.takeProfit1}`);
                        console.log(`   🎯 OBJETIVO 2: ${resultado.analisisTecnico.takeProfit2}`);
                    }
                    console.log('🚨'.repeat(35) + '\n');
                    
                    // Beep de alerta (funciona en terminales)
                    process.stdout.write('\x07');
                }
                
                // Detectar cambio de señal
                if (señalAnterior && señalAnterior !== resultado.decision && 
                    resultado.decision !== '⚪ NEUTRAL - ESPERAR') {
                    console.log('\n⚠️  ¡CAMBIO DE SEÑAL DETECTADO!');
                    console.log(`   Anterior: ${señalAnterior}`);
                    console.log(`   Actual: ${resultado.decision}\n`);
                }
                
            } catch (error) {
                console.error(`❌ Error con ${symbol}:`, error.message);
            }
        }
        
        // Resumen de estado
        console.log('\n' + '─'.repeat(70));
        console.log(`📊 ESTADO ACTUAL DEL MONITOREO:`);
        Object.keys(ultimasSeñales).forEach(symbol => {
            const emoji = ultimasSeñales[symbol].includes('COMPRA') ? '🟢' : 
                         ultimasSeñales[symbol].includes('VENTA') ? '🔴' : '⚪';
            console.log(`   ${emoji} ${symbol}: ${ultimasSeñales[symbol]}`);
        });
        console.log(`⏰ Próxima revisión en ${checkIntervalMs/1000} segundos...`);
        console.log('─'.repeat(70));
    };
    
    await analizar();
    setInterval(analizar, checkIntervalMs);
}

// Ejemplo de uso
if (require.main === module) {
    // Análisis único con IA
    // analisisConIA('USD/JPY', '5min');
    
    // Monitoreo en TIEMPO REAL (cada 1 minuto con velas de 1min)
    monitoreoConIA(['USD/JPY', 'EUR/USD', 'GBP/USD'], '5min', 300000)
}

module.exports = {
    analisisConIA,
    monitoreoConIA,
    predecirMovimiento,
    analizarSentimientoNoticias
};

const axios = require('axios');

const API_KEY = 'a27117528e9f4c36a739e148011564c9';

/**
 * Calcula soportes y resistencias usando pivotes
 */
function calcularPivotes(high, low, close) {
    const pivot = (high + low + close) / 3;
    
    const r1 = (2 * pivot) - low;
    const r2 = pivot + (high - low);
    const r3 = high + 2 * (pivot - low);
    
    const s1 = (2 * pivot) - high;
    const s2 = pivot - (high - low);
    const s3 = low - 2 * (high - pivot);
    
    return {
        pivot: pivot.toFixed(5),
        resistencias: [r1.toFixed(5), r2.toFixed(5), r3.toFixed(5)],
        soportes: [s1.toFixed(5), s2.toFixed(5), s3.toFixed(5)]
    };
}

/**
 * Calcula ATR (Average True Range) para volatilidad
 */
function calcularATR(datos, periodo = 14) {
    const trValues = [];
    
    for (let i = 1; i < datos.length && i <= periodo; i++) {
        const high = parseFloat(datos[i].high);
        const low = parseFloat(datos[i].low);
        const prevClose = parseFloat(datos[i - 1].close);
        
        const tr = Math.max(
            high - low,
            Math.abs(high - prevClose),
            Math.abs(low - prevClose)
        );
        trValues.push(tr);
    }
    
    return trValues.reduce((a, b) => a + b, 0) / trValues.length;
}

/**
 * Identifica patrones de velas
 */
function identificarPatron(datos) {
    const actual = datos[0];
    const anterior = datos[1];
    
    const body = Math.abs(parseFloat(actual.close) - parseFloat(actual.open));
    const upperShadow = parseFloat(actual.high) - Math.max(parseFloat(actual.close), parseFloat(actual.open));
    const lowerShadow = Math.min(parseFloat(actual.close), parseFloat(actual.open)) - parseFloat(actual.low);
    const range = parseFloat(actual.high) - parseFloat(actual.low);
    
    const bullish = parseFloat(actual.close) > parseFloat(actual.open);
    const bearish = parseFloat(actual.close) < parseFloat(actual.open);
    
    // Hammer (martillo) - Señal alcista
    if (lowerShadow > body * 2 && upperShadow < body * 0.3 && range > 0) {
        return { patron: '🔨 Hammer (Martillo)', señal: 'COMPRA', fuerza: 2 };
    }
    
    // Shooting Star - Señal bajista
    if (upperShadow > body * 2 && lowerShadow < body * 0.3 && range > 0) {
        return { patron: '⭐ Shooting Star', señal: 'VENTA', fuerza: 2 };
    }
    
    // Engulfing alcista
    if (bullish && bearish && 
        parseFloat(actual.close) > parseFloat(anterior.open) &&
        parseFloat(actual.open) < parseFloat(anterior.close)) {
        return { patron: '📈 Engulfing Alcista', señal: 'COMPRA', fuerza: 3 };
    }
    
    // Engulfing bajista
    if (bearish && bullish &&
        parseFloat(actual.close) < parseFloat(anterior.open) &&
        parseFloat(actual.open) > parseFloat(anterior.close)) {
        return { patron: '📉 Engulfing Bajista', señal: 'VENTA', fuerza: 3 };
    }
    
    // Doji - Indecisión
    if (body < range * 0.1) {
        return { patron: '⚪ Doji (Indecisión)', señal: 'NEUTRAL', fuerza: 0 };
    }
    
    return { patron: 'Sin patrón claro', señal: 'NEUTRAL', fuerza: 0 };
}

/**
 * Calcula RSI
 */
function calcularRSI(precios, periodo = 14) {
    if (precios.length < periodo) return null;
    
    let ganancias = 0;
    let perdidas = 0;
    
    for (let i = 1; i <= periodo; i++) {
        const cambio = precios[i] - precios[i - 1];
        if (cambio > 0) ganancias += cambio;
        else perdidas += Math.abs(cambio);
    }
    
    let avgGain = ganancias / periodo;
    let avgLoss = perdidas / periodo;
    
    const rs = avgGain / avgLoss;
    const rsi = 100 - (100 / (1 + rs));
    
    return rsi;
}

/**
 * Calcula EMA
 */
function calcularEMA(precios, periodo) {
    if (precios.length < periodo) return null;
    
    const k = 2 / (periodo + 1);
    let ema = precios[0];
    
    for (let i = 1; i < Math.min(precios.length, periodo * 2); i++) {
        ema = (precios[i] * k) + (ema * (1 - k));
    }
    
    return ema;
}

/**
 * Genera puntos de entrada y salida óptimos
 */
async function generarPuntosEntrada(symbol = 'USD/JPY', interval = '5min') {
    try {
        console.log(`\n🎯 ANÁLISIS DE PUNTOS DE ENTRADA/SALIDA - ${symbol}`);
        console.log('═'.repeat(70));
        
        // Obtener datos
        const response = await axios.get('https://api.twelvedata.com/time_series', {
            params: {
                symbol: symbol,
                interval: interval,
                outputsize: 100,
                apikey: API_KEY,
                timezone: 'UTC'
            }
        });
        
        if (response.data.status === 'error') {
            throw new Error(response.data.message);
        }
        
        const datos = response.data.values;
        const precios = datos.map(v => parseFloat(v.close)).reverse();
        const precioActual = parseFloat(datos[0].close);
        
        // 1. ANÁLISIS TÉCNICO
        console.log('\n📊 ANÁLISIS TÉCNICO ACTUAL');
        console.log('─'.repeat(70));
        
        const rsi = calcularRSI(precios, 14);
        const ema9 = calcularEMA(precios, 9);
        const ema21 = calcularEMA(precios, 21);
        const ema50 = calcularEMA(precios, 50);
        const atr = calcularATR(datos.slice(0, 15), 14);
        
        console.log(`💰 Precio actual: ${precioActual.toFixed(5)}`);
        console.log(`📈 RSI (14): ${rsi.toFixed(2)}`);
        console.log(`📊 EMA 9: ${ema9.toFixed(5)}`);
        console.log(`📊 EMA 21: ${ema21.toFixed(5)}`);
        console.log(`📊 EMA 50: ${ema50.toFixed(5)}`);
        console.log(`📉 ATR (volatilidad): ${atr.toFixed(5)}`);
        
        // 2. PIVOTES (SOPORTES Y RESISTENCIAS)
        console.log('\n🎯 NIVELES CLAVE (PIVOTES)');
        console.log('─'.repeat(70));
        
        const high24h = Math.max(...datos.slice(0, 24).map(d => parseFloat(d.high)));
        const low24h = Math.min(...datos.slice(0, 24).map(d => parseFloat(d.low)));
        const close24h = parseFloat(datos[24]?.close || datos[0].close);
        
        const pivotes = calcularPivotes(high24h, low24h, close24h);
        
        console.log(`📍 Pivot Point: ${pivotes.pivot}`);
        console.log(`\n🔴 RESISTENCIAS (objetivos de venta):`);
        console.log(`   R1: ${pivotes.resistencias[0]}`);
        console.log(`   R2: ${pivotes.resistencias[1]}`);
        console.log(`   R3: ${pivotes.resistencias[2]}`);
        console.log(`\n🟢 SOPORTES (objetivos de compra):`);
        console.log(`   S1: ${pivotes.soportes[0]}`);
        console.log(`   S2: ${pivotes.soportes[1]}`);
        console.log(`   S3: ${pivotes.soportes[2]}`);
        
        // 3. PATRÓN DE VELAS
        console.log('\n🕯️  PATRÓN DE VELAS');
        console.log('─'.repeat(70));
        
        const patron = identificarPatron(datos);
        console.log(`${patron.patron} → ${patron.señal}`);
        
        // 4. DETERMINACIÓN DE SEÑAL
        let puntuacionCompra = 0;
        let puntuacionVenta = 0;
        const razones = [];
        
        // RSI
        if (rsi < 30) {
            puntuacionCompra += 3;
            razones.push('🟢 RSI sobreventa (<30)');
        } else if (rsi < 40) {
            puntuacionCompra += 1;
            razones.push('🟡 RSI bajo (<40)');
        } else if (rsi > 70) {
            puntuacionVenta += 3;
            razones.push('🔴 RSI sobrecompra (>70)');
        } else if (rsi > 60) {
            puntuacionVenta += 1;
            razones.push('🟡 RSI alto (>60)');
        }
        
        // EMAs
        if (precioActual > ema9 && ema9 > ema21 && ema21 > ema50) {
            puntuacionCompra += 3;
            razones.push('🟢 Alineación alcista de EMAs');
        } else if (precioActual < ema9 && ema9 < ema21 && ema21 < ema50) {
            puntuacionVenta += 3;
            razones.push('🔴 Alineación bajista de EMAs');
        }
        
        // Patrón de velas
        if (patron.señal === 'COMPRA') {
            puntuacionCompra += patron.fuerza;
            razones.push(`🟢 ${patron.patron}`);
        } else if (patron.señal === 'VENTA') {
            puntuacionVenta += patron.fuerza;
            razones.push(`🔴 ${patron.patron}`);
        }
        
        // Distancia del precio a soportes/resistencias
        const distanciaS1 = Math.abs(precioActual - parseFloat(pivotes.soportes[0]));
        const distanciaR1 = Math.abs(precioActual - parseFloat(pivotes.resistencias[0]));
        
        if (distanciaS1 < atr * 0.5) {
            puntuacionCompra += 2;
            razones.push('🟢 Cerca del soporte S1');
        }
        if (distanciaR1 < atr * 0.5) {
            puntuacionVenta += 2;
            razones.push('🔴 Cerca de la resistencia R1');
        }
        
        // 5. DECISIÓN Y PUNTOS DE ENTRADA/SALIDA
        console.log('\n⚡ ANÁLISIS DE SEÑAL');
        console.log('─'.repeat(70));
        console.log(`Puntuación COMPRA: ${puntuacionCompra}`);
        console.log(`Puntuación VENTA: ${puntuacionVenta}`);
        console.log('\nRazones:');
        razones.forEach(r => console.log(`  ${r}`));
        
        console.log('\n' + '═'.repeat(70));
        
        if (puntuacionCompra > puntuacionVenta && puntuacionCompra >= 4) {
            // SEÑAL DE COMPRA
            const entrada = precioActual;
            const stopLoss = entrada - (atr * 1.5);
            const takeProfit1 = parseFloat(pivotes.resistencias[0]);
            const takeProfit2 = parseFloat(pivotes.resistencias[1]);
            const riesgo = entrada - stopLoss;
            const beneficio1 = takeProfit1 - entrada;
            const beneficio2 = takeProfit2 - entrada;
            const ratio1 = beneficio1 / riesgo;
            const ratio2 = beneficio2 / riesgo;
            
            console.log('\n🟢🟢🟢 SEÑAL DE COMPRA (LONG)');
            console.log('═'.repeat(70));
            console.log(`📍 ENTRADA: ${entrada.toFixed(5)}`);
            console.log(`🛑 STOP LOSS: ${stopLoss.toFixed(5)} (-${riesgo.toFixed(5)} pips)`);
            console.log(`\n🎯 TAKE PROFIT 1: ${takeProfit1.toFixed(5)} (+${beneficio1.toFixed(5)} pips)`);
            console.log(`   Ratio R/R: 1:${ratio1.toFixed(2)}`);
            console.log(`🎯 TAKE PROFIT 2: ${takeProfit2.toFixed(5)} (+${beneficio2.toFixed(5)} pips)`);
            console.log(`   Ratio R/R: 1:${ratio2.toFixed(2)}`);
            
            console.log(`\n💡 ESTRATEGIA:`);
            console.log(`   - Comprar AHORA en ${entrada.toFixed(5)}`);
            console.log(`   - Colocar Stop Loss en ${stopLoss.toFixed(5)}`);
            console.log(`   - Tomar 50% de ganancias en TP1 (${takeProfit1.toFixed(5)})`);
            console.log(`   - Dejar 50% correr hasta TP2 (${takeProfit2.toFixed(5)})`);
            console.log(`   - Mover SL a breakeven cuando llegue a TP1`);
            
            return {
                señal: 'COMPRA',
                entrada: entrada.toFixed(5),
                stopLoss: stopLoss.toFixed(5),
                takeProfit1: takeProfit1.toFixed(5),
                takeProfit2: takeProfit2.toFixed(5),
                riesgo: riesgo.toFixed(5),
                ratioRR1: ratio1.toFixed(2),
                ratioRR2: ratio2.toFixed(2)
            };
            
        } else if (puntuacionVenta > puntuacionCompra && puntuacionVenta >= 4) {
            // SEÑAL DE VENTA
            const entrada = precioActual;
            const stopLoss = entrada + (atr * 1.5);
            const takeProfit1 = parseFloat(pivotes.soportes[0]);
            const takeProfit2 = parseFloat(pivotes.soportes[1]);
            const riesgo = stopLoss - entrada;
            const beneficio1 = entrada - takeProfit1;
            const beneficio2 = entrada - takeProfit2;
            const ratio1 = beneficio1 / riesgo;
            const ratio2 = beneficio2 / riesgo;
            
            console.log('\n🔴🔴🔴 SEÑAL DE VENTA (SHORT)');
            console.log('═'.repeat(70));
            console.log(`📍 ENTRADA: ${entrada.toFixed(5)}`);
            console.log(`🛑 STOP LOSS: ${stopLoss.toFixed(5)} (+${riesgo.toFixed(5)} pips)`);
            console.log(`\n🎯 TAKE PROFIT 1: ${takeProfit1.toFixed(5)} (-${beneficio1.toFixed(5)} pips)`);
            console.log(`   Ratio R/R: 1:${ratio1.toFixed(2)}`);
            console.log(`🎯 TAKE PROFIT 2: ${takeProfit2.toFixed(5)} (-${beneficio2.toFixed(5)} pips)`);
            console.log(`   Ratio R/R: 1:${ratio2.toFixed(2)}`);
            
            console.log(`\n💡 ESTRATEGIA:`);
            console.log(`   - Vender AHORA en ${entrada.toFixed(5)}`);
            console.log(`   - Colocar Stop Loss en ${stopLoss.toFixed(5)}`);
            console.log(`   - Tomar 50% de ganancias en TP1 (${takeProfit1.toFixed(5)})`);
            console.log(`   - Dejar 50% correr hasta TP2 (${takeProfit2.toFixed(5)})`);
            console.log(`   - Mover SL a breakeven cuando llegue a TP1`);
            
            return {
                señal: 'VENTA',
                entrada: entrada.toFixed(5),
                stopLoss: stopLoss.toFixed(5),
                takeProfit1: takeProfit1.toFixed(5),
                takeProfit2: takeProfit2.toFixed(5),
                riesgo: riesgo.toFixed(5),
                ratioRR1: ratio1.toFixed(2),
                ratioRR2: ratio2.toFixed(2)
            };
            
        } else {
            console.log('\n⚪ SIN SEÑAL CLARA - ESPERAR');
            console.log('═'.repeat(70));
            console.log('No hay suficiente confirmación para una entrada óptima.');
            console.log('Espera a que se formen condiciones más favorables.');
            console.log(`\n📊 Monitorear niveles:`);
            console.log(`   Compra si cae a: ${pivotes.soportes[0]} (S1)`);
            console.log(`   Venta si sube a: ${pivotes.resistencias[0]} (R1)`);
            
            return { señal: 'NEUTRAL' };
        }
        
    } catch (error) {
        console.error('❌ Error:', error.message);
        throw error;
    }
}

/**
 * Monitoreo continuo esperando puntos óptimos
 */
async function esperarPuntoOptimo(symbols = ['USD/JPY'], interval = '5min', checkIntervalMs = 300000) {
    console.log('🔄 MONITOREO CONTINUO - BUSCANDO PUNTOS ÓPTIMOS');
    console.log('═'.repeat(70));
    console.log(`Pares: ${symbols.join(', ')}`);
    console.log(`Intervalo: ${interval}`);
    console.log(`Revisión cada: ${checkIntervalMs/1000} segundos\n`);
    
    const analizar = async () => {
        console.log('\n\n' + '█'.repeat(70));
        console.log(`🕐 ${new Date().toLocaleString('es-ES')}`);
        console.log('█'.repeat(70));
        
        for (const symbol of symbols) {
            try {
                await generarPuntosEntrada(symbol, interval);
            } catch (error) {
                console.error(`Error con ${symbol}:`, error.message);
            }
        }
    };
    
    await analizar();
    setInterval(analizar, checkIntervalMs);
}

// Ejemplo de uso
if (require.main === module) {
    // Análisis único
    generarPuntosEntrada('USD/JPY', '5min');
    
    // Monitoreo continuo
    // esperarPuntoOptimo(['USD/JPY', 'EUR/USD'], '5min', 300000);
}

module.exports = {
    generarPuntosEntrada,
    esperarPuntoOptimo
};

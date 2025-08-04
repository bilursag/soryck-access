// src/app/api/test/generate-token-cuotas/route.ts - ARCHIVO COMPLETO

import { NextRequest, NextResponse } from 'next/server'
import { webpayPlus } from '@/lib/transbank'

// ✅ FUNCIÓN PARA GENERAR buyOrder CORTO Y VÁLIDO
function generateShortBuyOrder(prefix: string = 'C'): string {
  const now = new Date()
  const year = now.getFullYear().toString().slice(-2)  // 2 dígitos
  const month = String(now.getMonth() + 1).padStart(2, '0')  // 2 dígitos
  const day = String(now.getDate()).padStart(2, '0')  // 2 dígitos
  const hour = String(now.getHours()).padStart(2, '0')  // 2 dígitos
  const minute = String(now.getMinutes()).padStart(2, '0')  // 2 dígitos
  const second = String(now.getSeconds()).padStart(2, '0')  // 2 dígitos
  const ms = String(now.getMilliseconds()).padStart(3, '0').slice(0, 2)  // 2 dígitos
  const random = Math.random().toString(36).substr(2, 2).toUpperCase()  // 2 caracteres
  
  // Formato: PREFIJO + YYMMDDHHMMSSMMRR = máximo 20 caracteres
  const buyOrder = `${prefix}${year}${month}${day}${hour}${minute}${second}${ms}${random}`
  
  // Validar longitud
  if (buyOrder.length > 26) {
    console.warn(`buyOrder demasiado largo: ${buyOrder.length} caracteres. Recortando...`)
    return buyOrder.substring(0, 26)
  }
  
  console.log(`buyOrder generado: ${buyOrder} (${buyOrder.length} caracteres)`)
  return buyOrder
}

// ✅ FUNCIÓN PARA GENERAR sessionId CORTO
function generateShortSessionId(testType: string, cuotas?: number): string {
  const timestamp = Date.now().toString(36) // Base 36 es más corto
  const prefix = cuotas ? `c${cuotas}` : 'sess'
  const suffix = testType.charAt(0) // 'a' para approve, 'r' para reject
  
  // Formato: prefijo + timestamp + sufijo
  const sessionId = `${prefix}-${timestamp}-${suffix}`
  
  // Validar longitud (máximo 61 caracteres)
  if (sessionId.length > 61) {
    console.warn(`sessionId demasiado largo: ${sessionId.length} caracteres. Recortando...`)
    return sessionId.substring(0, 61)
  }
  
  console.log(`sessionId generado: ${sessionId} (${sessionId.length} caracteres)`)
  return sessionId
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { 
      cuotas = 6, 
      testType = 'approve',
      customAmount 
    } = body

    // Calcular monto mínimo según las cuotas solicitadas
    let amount: number
    if (customAmount) {
      amount = customAmount
    } else {
      // Montos mínimos reales de Transbank para cuotas
      if (cuotas <= 3) {
        amount = 3000  // $3,000 para 2-3 cuotas
      } else if (cuotas <= 12) {
        amount = 10000 // $10,000 para 4-12 cuotas
      } else if (cuotas <= 24) {
        amount = 50000 // $50,000 para 13-24 cuotas
      } else {
        amount = 100000 // $100,000 para más de 24 cuotas
      }
    }

    // ✅ USAR FUNCIONES CORREGIDAS
    const buyOrder = generateShortBuyOrder('C')
    const sessionId = generateShortSessionId(testType, cuotas)
    const returnUrl = `${process.env.NEXT_PUBLIC_APP_URL}/api/transbank/return`

    console.log('🏦 Generando token para transacción CON CUOTAS:', {
      cuotas,
      testType,
      amount,
      buyOrder: `${buyOrder} (${buyOrder.length} chars)`,
      sessionId: `${sessionId} (${sessionId.length} chars)`,
      returnUrl
    })

    // Validaciones estrictas de Transbank
    if (buyOrder.length > 26) {
      throw new Error(`buyOrder demasiado largo: ${buyOrder.length} caracteres (máximo 26)`)
    }
    
    if (sessionId.length > 61) {
      throw new Error(`sessionId demasiado largo: ${sessionId.length} caracteres (máximo 61)`)
    }
    
    if (amount <= 0 || amount > 999999999) {
      throw new Error(`Monto inválido: ${amount} (debe estar entre 1 y 999,999,999)`)
    }

    // Crear transacción
    const response = await webpayPlus.create(
      buyOrder,
      sessionId,
      amount,
      returnUrl
    )

    console.log('✅ Transacción creada exitosamente:', {
      token: response.token,
      url: response.url
    })

    // Determinar tarjeta según tipo de test
    const cardData = testType === 'reject' ? {
      number: '4051885600446600',
      result: 'SERÁ RECHAZADA ❌'
    } : {
      number: '4051885600446623',
      result: 'SERÁ APROBADA ✅'
    }

    // Calcular cuota aproximada (sin intereses para el ejemplo)
    const cuotaAprox = Math.ceil(amount / cuotas)

    return NextResponse.json({
      success: true,
      token: response.token,
      paymentUrl: response.url,
      transactionDetails: {
        buyOrder,
        sessionId,
        amount,
        cuotasEsperadas: cuotas,
        cuotaAproximada: cuotaAprox,
        validations: {
          buyOrderLength: `${buyOrder.length}/26 caracteres`,
          sessionIdLength: `${sessionId.length}/61 caracteres`,
          amountValid: amount > 0 && amount <= 999999999
        }
      },
      instructions: {
        step1: `🎫 TOKEN PARA FORMULARIO: ${response.token}`,
        step2: `💰 Monto: $${amount.toLocaleString('es-CL')} CLP`,
        step3: `📊 Optimizado para ${cuotas} cuotas`,
        step4: `🌐 URL: ${response.url}`,
        step5: 'Datos de tarjeta:',
        cardData: {
          number: cardData.number,
          cvv: '123',
          month: '11',
          year: '23',
          type: '🏦 CRÉDITO (obligatorio)',
          result: cardData.result
        },
        step6: `🔢 Selecciona ${cuotas} cuotas (o cualquier otra)`,
        step7: '✅ Confirma la transacción'
      },
      cuotasDisponibles: {
        2: { montoMinimo: 3000, disponible: amount >= 3000 },
        3: { montoMinimo: 3000, disponible: amount >= 3000 },
        6: { montoMinimo: 10000, disponible: amount >= 10000 },
        9: { montoMinimo: 10000, disponible: amount >= 10000 },
        12: { montoMinimo: 10000, disponible: amount >= 10000 },
        18: { montoMinimo: 50000, disponible: amount >= 50000 },
        24: { montoMinimo: 50000, disponible: amount >= 50000 }
      },
      forTransbankForm: {
        token: response.token,
        conditions: {
          medioDepago: '💳 Tarjeta de CRÉDITO',
          cuotas: `🔢 CON cuotas (selecciona ${cuotas} o cualquier otra)`,
          resultado: testType === 'reject' ? '❌ Rechazar' : '✅ Aprobar'
        }
      }
    })

  } catch (error) {
    console.error('❌ Error generando token para cuotas:', error)
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido',
      troubleshooting: [
        'buyOrder debe tener máximo 26 caracteres',
        'sessionId debe tener máximo 61 caracteres', 
        'Monto debe estar entre 1 y 999,999,999',
        'Verifica que NEXT_PUBLIC_APP_URL esté configurado correctamente'
      ]
    }, { status: 500 })
  }
}

export async function GET() {
  return NextResponse.json({
    message: 'Generador de tokens optimizado para transacciones CON CUOTAS',
    usage: {
      endpoint: '/api/test/generate-token-cuotas',
      method: 'POST',
      parameters: {
        cuotas: 'number (2-24, default: 6)',
        testType: 'string ("approve" | "reject", default: "approve")',
        customAmount: 'number (opcional, si no se especifica se calcula automáticamente)'
      }
    },
    examples: [
      {
        description: 'Token para 6 cuotas APROBADAS',
        request: 'POST /api/test/generate-token-cuotas',
        body: { cuotas: 6, testType: 'approve' }
      },
      {
        description: 'Token para 12 cuotas APROBADAS',
        request: 'POST /api/test/generate-token-cuotas', 
        body: { cuotas: 12, testType: 'approve' }
      }
    ],
    montosMinimos: {
      '2-3 cuotas': '$3.000 CLP',
      '4-12 cuotas': '$10.000 CLP', 
      '13-24 cuotas': '$50.000 CLP',
      '25+ cuotas': '$100.000 CLP'
    }
  })
}
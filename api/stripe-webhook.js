/**
 * WHIDER · Atajo para Vercel: si el proyecto de pagos se publica desde la raíz del repositorio (sin
 * «Root Directory» = pagos), /api/stripe-webhook sigue existiendo. El código está en
 * pagos/api/stripe-webhook.js (la misma función: firma de Stripe, Premium en Firestore y estado en GET).
 */
'use strict';
module.exports = require('../pagos/api/stripe-webhook.js');

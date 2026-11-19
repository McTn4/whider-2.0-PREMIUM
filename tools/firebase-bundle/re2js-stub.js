// Sustituto de re2js en el paquete de Firebase (ver package.json, --alias:re2js).
// El Firestore completo trae re2js (146 KB) solo para evaluar en el dispositivo las expresiones LIKE y de
// expresiones regulares de las consultas «pipeline», que WHIDER no usa (solo escucha documentos y consultas
// normales). Si algo llegara a usarlas, Firestore recibe este error y lo trata como una expresión no válida.
export const RE2JS = {
  compile: function () {
    throw new Error('re2js no está incluido en el paquete de WHIDER');
  }
};

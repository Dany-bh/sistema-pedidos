const express = require('express');
const http = require('http');
const socketIo = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

const port = process.env.PORT || 3000;

app.use(express.static('public'));

const path = require('path');


let pedidos = [];
let historialPedidos = []; // Aquí guardamos el historial completo de pedidos entregados
let siguienteId = 1;

io.on('connection', socket => {
  console.log('Cliente conectado:', socket.id);
  socket.emit('pedidosActuales', pedidos);
  socket.emit('historialActualizado', historialPedidos);

  socket.on('nuevoPedido', pedido => {
    pedido.id = siguienteId++;
    pedido.estado = 'pendiente';
    pedido.tiempoInicio = Date.now();
    pedido.horaInicio = new Date().toLocaleString('es-PE', {
      timeZone: 'America/Lima',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    }).replace(',', '');
    
    pedido.items = pedido.items.map(item => ({ nombre: item, listo: false }));
    pedidos.unshift(pedido); // Agrega el nuevo pedido al inicio (orden más reciente)
    io.emit('pedidosActuales', pedidos);
    io.emit('nuevoPedidoSonido');
  });

  socket.on('marcarPlatoListo', ({ pedidoId, itemIndex }) => {
    const pedido = pedidos.find(p => p.id === pedidoId);
    if (pedido) {
      pedido.items[itemIndex].listo = true;
      io.emit('pedidoListoSonido'); // Sonido para cada plato listo

      if (pedido.items.every(i => i.listo)) {
        pedido.estado = 'listo';
        pedido.tiempoFin = Date.now();
        const duracionMs = pedido.tiempoFin - pedido.tiempoInicio;
        const minutos = Math.floor(duracionMs / 60000);
        const segundos = Math.floor((duracionMs % 60000) / 1000);
        pedido.duracion = `${String(minutos).padStart(2, '0')}:${String(segundos).padStart(2, '0')} segundos`;
      }

      io.emit('pedidosActuales', pedidos);
    }
  });

  socket.on('resetListos', () => {
    // PASO IMPORTANTE: Guardar pedidos listos en historial antes de borrarlos
    const pedidosListos = pedidos.filter(p => p.estado === 'listo');
    historialPedidos.unshift(...pedidosListos);

    // Eliminar pedidos listos de la lista activa
    pedidos = pedidos.filter(p => p.estado !== 'listo');

    io.emit('pedidosActuales', pedidos);
    io.emit('historialActualizado', historialPedidos);
  });

  socket.on('limpiarHistorial', () => {
    historialPedidos = [];
    io.emit('historialActualizado', historialPedidos);
  });

  socket.on('disconnect', () => {
    console.log('Cliente desconectado:', socket.id);
  });
});


server.listen(port, '0.0.0.0', () => {
  console.log(`🍽️ El Maná corriendo en http://localhost:${port}`);
});

app.get('/historial', (req, res) => {
  // Ordena por tiempoInicio descendente: pedidos más recientes primero
  const historialOrdenado = [...historialPedidos].sort((a, b) => b.tiempoInicio - a.tiempoInicio);
  res.json(historialOrdenado);
})
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/public/index.html');
})

app.get('*', (req, res) => {
  res.sendFile(path.resolve(__dirname, 'public', 'index.html'));
})
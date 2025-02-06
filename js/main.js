// Importar librerias de firebase

import { initializeApp } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-app.js";
import { getDatabase, set, ref, push, onValue, get } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-database.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-analytics.js";


// Configuración de Firebase
const firebaseConfig = {
    apiKey: "AIzaSyAPkF96IwZ2Rsv9VYnD7daMgW25LCSx9h4",
    authDomain: "cocktailmachine-nano.firebaseapp.com",
    databaseURL: "https://cocktailmachine-nano-default-rtdb.firebaseio.com",
    projectId: "cocktailmachine-nano",
    storageBucket: "cocktailmachine-nano.firebasestorage.app",
    messagingSenderId: "739817884748",
    appId: "1:739817884748:web:ef0ab44c625572c93138e9",
    measurementId: "G-DEK6MZS427"
};

// Inicializar Firebase
const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

//Ordenar
window.ordenar = async function(recetaNombre) {
    try {

        // Verificar si los ingredientes estan presentes
        const indredientesPosicion = await get(ref(db, 'ingredientesEnPosicion'));
        const ingredienteAll = indredientesPosicion.val();

        // Verificar si ya hay un pedido en proceso
        const pedidoSnapshot = await get(ref(db, 'pedido/preparar'));
        const pedidoEnProceso = pedidoSnapshot.val();

        if (pedidoEnProceso) {
            Swal.fire('Ya hay un pedido en proceso');
            return;
        }

        if (!ingredienteAll) {
            Swal.fire('Por favor, verifique que los ingredientes esten en posicion');
            return;
        }
        
        // Verificar si el vaso está presente
        const vasoSnapshot = await get(ref(db, 'vasoPresente'));
        const vasoPresente = vasoSnapshot.val();

        if (!vasoPresente) {
            Swal.fire('Por favor, coloque el vaso en su posición.');
            return;
        }

        // Obtener volúmenes y recetas
        const [volumes, recipes] = await Promise.all([
            get(ref(db, 'volumes')),
            get(ref(db, 'recipes'))
        ]);
        
        const receta = recipes.val()[recetaNombre];
        const volumenes = volumes.val();

        console.log(receta);
        console.log(volumenes);
        
        // Verificar ingredientes
        for (let ingrediente in receta) {
            if (volumenes[ingrediente] < receta[ingrediente] + 10) {
                Swal.fire('Ingredientes insuficientes');
                return;
            }
        }

        // Crear pedido en la base de datos
        await set(ref(db, 'pedido'), {
            ingredientes: receta,
            preparar: true,
            listo: false
        });

        
        // Mostrar diálogo de preparación
        document.getElementById('bloqueo').style.display = 'block';
        
        
        //Guardar en Historial
        registrarReceta(db, 'historial',recetaNombre,receta);
        await actualizarVolumenes(receta);

        // Escuchar cambios en el estado del pedido
        onValue(ref(db, 'pedido/listo'), (snapshot) => {
            if (snapshot.val() === true) {
                document.getElementById('bloqueo').style.display = 'none';
                Swal.fire('¡Tu bebida está lista!');
                set(ref(db,'pedido/listo'),false)
                set(ref(db,'pedido/preparar'),false)
            }
        });
        
    } catch (error) {
        console.error('Error:', error);        
        Swal.fire('Ocurrió un error al procesar tu pedido');
    }
}

//Limpiar
window.cleanPumps = async function() {
    try {
        
        // Verificar si ya hay un pedido en proceso
        const pedidoSnapshot = await get(ref(db, 'pedido/preparar'));
        const pedidoEnProceso = pedidoSnapshot.val();

        if (pedidoEnProceso) {
            Swal.fire('Ya hay un pedido en proceso');
            return;
        }

        // Verificar si el vaso está presente
        const vasoSnapshot = await get(ref(db, 'vasoPresente'));
        const vasoPresente = vasoSnapshot.val();

        if (!vasoPresente) {
            Swal.fire('Por favor, coloque el vaso en su posición.');
            return;
        }
        
        const limpiar = get(ref(db,'limpiar'))

        await set(ref(db,'limpiar/orden'),true);

        if (!limpiar['orden']){
            document.getElementById('cleaning').style.display = 'block';
        }else{
            return
        }        
        
        onValue(ref(db, 'limpiar/orden'), (snapshot) => {
            if (snapshot.val() === false) {
                document.getElementById('cleaning').style.display = 'none';
                Swal.fire('¡Limpieza Terminada!');
                set(ref(db,'limpiar/orden'),false)
            }
        });
        
    } catch (error) {
        console.error('Error:', error);        
        Swal.fire('Ocurrió un error al procesar tu pedido');
    }
}
//Funciones

//Actualizar Tabla de historial

const mostrarHistorial = () => {
    // Referencia al historial en Firebase
    const historialRef = ref(db, 'historial');
    
    // Obtener el contenedor
    const contenedor = document.getElementById('historialContenedor');
    
    // Escuchar cambios en el historial
    onValue(historialRef, (snapshot) => {
        if (!snapshot.exists()) {
            contenedor.innerHTML = '<p>No hay pedidos registrados</p>';
            return;
        }

        // Crear la tabla
        let tablaHTML = `
            <table class="table">
                <thead>
                    <tr>
                        <th>Fecha</th>
                        <th>Receta</th>
                        <th>Ingredientes</th>
                    </tr>
                </thead>
                <tbody>
        `;

        // Convertir los datos a array y ordenarlos por fecha
        const pedidos = [];
        snapshot.forEach((childSnapshot) => {
            pedidos.push(childSnapshot.val());
        });

        // Ordenar por fecha más reciente
        pedidos.sort((a, b) => b.fecha - a.fecha);

        // Agregar cada pedido a la tabla
        pedidos.forEach(pedido => {
            const fecha = new Date(pedido.fecha).toLocaleString();
            const ingredientes = Object.entries(pedido.ingredientes)
                .map(([nombre, cantidad]) => `${nombre}: ${cantidad}ml`)
                .join('<br>');

            tablaHTML += `
                <tr>
                    <td>${fecha}</td>
                    <td>${pedido.nombre}</td>
                    <td>${ingredientes}</td>
                </tr>
            `;
        });

        tablaHTML += `
                </tbody>
            </table>
        `;

        // Mostrar la tabla
        contenedor.innerHTML = tablaHTML;
    });
}

//Registro de Recetas
const registrarReceta = (db, path, recetaNombre, receta) =>{

    const fecha = new Date();

    push(ref(db, path), {
        nombre: recetaNombre,
        ingredientes: receta,
        fecha: fecha.toUTCString()
    });


}

//Actualizar Volumenes

// Actualizar volúmenes en la base de datos
const actualizarVolumenes = async (receta) => {
    try {
        // Obtener los volúmenes actuales de la base de datos
        const volumesSnapshot = await get(ref(db, 'volumes'));
        const volumes = volumesSnapshot.val();

        // Restar la cantidad utilizada de cada ingrediente
        for (let ingrediente in receta) {
            if (volumes[ingrediente] !== undefined) {
                volumes[ingrediente] -= receta[ingrediente];
                
                // Asegurar que el volumen no sea negativo
                if (volumes[ingrediente] < 0) {
                    volumes[ingrediente] = 0;
                }
            }
        }

        // Guardar los volúmenes actualizados en la base de datos
        await set(ref(db, 'volumes'), volumes);
        console.log('Volúmenes actualizados correctamente:', volumes);
    } catch (error) {
        console.error('Error al actualizar los volúmenes:', error);
        Swal.fire('Ocurrió un error al actualizar los volúmenes');
    }
}


// Función para mostrar los volúmenes actuales
const cargarVolumenesActuales = () => {
    const volumenesRef = ref(db, 'volumes');
    onValue(volumenesRef, (snapshot) => {
        const volumenes = snapshot.val();
        const tablaActuales = document.querySelector('#volumenes-actuales tbody');
        tablaActuales.innerHTML = '';

        for (let ingrediente in volumenes) {
            tablaActuales.innerHTML += `
                <tr>
                    <td>${ingrediente}</td>
                    <td>${volumenes[ingrediente]}</td>
                </tr>
            `;
        }
    });
};

// Función para mostrar campos de entrada para volúmenes iniciales
const cargarVolumenesIniciales = () => {
    const volumenesRef = ref(db, 'volumes');
    onValue(volumenesRef, (snapshot) => {
        const volumenes = snapshot.val();
        const tablaIniciales = document.querySelector('#volumenes-iniciales tbody');
        tablaIniciales.innerHTML = '';

        for (let ingrediente in volumenes) {
            tablaIniciales.innerHTML += `
                <tr>
                    <td>${ingrediente}</td>
                    <td><input type="number" id="volumen-${ingrediente}" value="${volumenes[ingrediente]}"></td>
                </tr>
            `;
        }
    });
};

// Función para guardar los volúmenes iniciales
const guardarVolumenes = () => {
    const volumenesRef = ref(db, 'volumes');
    const nuevosVolumenes = {};

    document.querySelectorAll('#volumenes-iniciales input').forEach(input => {
        const ingrediente = input.id.replace('volumen-', '');
        const valor = parseInt(input.value);
        nuevosVolumenes[ingrediente] = valor;
    });

    set(volumenesRef, nuevosVolumenes)
        .then(() => Swal.fire('Volúmenes actualizados correctamente'))
        .catch((error) => Swal.fire('Error al actualizar volúmenes:', error));
};

// Función para mostrar y editar densidades
const cargarDensidades = () => {
    const densidadesRef = ref(db, 'densities');
    onValue(densidadesRef, (snapshot) => {
        const densidades = snapshot.val() || {};
        const tablaDensidades = document.querySelector('#densidades tbody');
        tablaDensidades.innerHTML = '';

        for (let ingrediente in densidades) {
            tablaDensidades.innerHTML += `
                <tr>
                    <td>${ingrediente}</td>
                    <td><input type="number" id="densidad-${ingrediente}" step="0.01" value="${densidades[ingrediente]}"></td>
                </tr>
            `;
        }
    });
};

// Función para guardar las densidades
const guardarDensidades = () => {
    const densidadesRef = ref(db, 'densities');
    const nuevasDensidades = {};

    document.querySelectorAll('#densidades input').forEach(input => {
        const ingrediente = input.id.replace('densidad-', '');
        const valor = parseFloat(input.value);
        nuevasDensidades[ingrediente] = valor;
    });

    set(densidadesRef, nuevasDensidades)
        .then(() => Swal.fire('Densidades actualizadas correctamente'))
        .catch((error) => Swal.fire('Error al actualizar densidades:', error));
};


//Mostrar cada seccion

window.showSection = function(sectionID){

    document.querySelectorAll('.section').forEach(section => {
        section.classList.remove('active');
    })
    
    const section = document.getElementById(sectionID)

    if (section){
        section.classList.add('active')
        if (sectionID == 'historial'){
            mostrarHistorial();
        }
    }else {
        console.error('El ID no existe')
    }

}


// Función para crear el pedido personalizado
window.crearPedidoPersonalizado = async function() {
    try {

        // Verificar si ya hay un pedido en proceso
        const pedidoSnapshot = await get(ref(db, 'pedido/preparar'));
        const pedidoEnProceso = pedidoSnapshot.val();

        if (pedidoEnProceso) {
            Swal.fire('Ya hay un pedido en proceso');
            return;
        }
        
        // Verificar si los ingredientes estan presentes
        const indredientesPosicion = await get(ref(db, 'ingredientesEnPosicion'));
        const ingredienteAll = indredientesPosicion.val();

        if (!ingredienteAll) {
            Swal.fire('Por favor, verifique que los ingredientes esten en posición');
            return;
        }
        
        // Verificar si el vaso está presente
        const vasoSnapshot = await get(ref(db, 'vasoPresente'));
        const vasoPresente = vasoSnapshot.val();

        if (!vasoPresente) {
            Swal.fire('Por favor, coloque el vaso en su posición.');
            return;
        }

        const ingredientesSeleccionados = {};

        // Seleccionar todos los elementos <select> dentro de la sección de cócteles personalizados
        document.querySelectorAll('#personalizado select').forEach(select => {
            const cantidad = parseInt(select.value);
            let ingrediente = select.previousElementSibling.textContent.trim().toLowerCase(); // Obtener el nombre del ingrediente del <h3>
            console.log(ingrediente)
            
            ingrediente = ingrediente === "triple sec" ? "tripleSec" : ingrediente;

            if (cantidad > 0) { // Ignorar ingredientes con valor 0 ml
                ingredientesSeleccionados[ingrediente] = cantidad;
            }
        });

        // Verificar si se seleccionó al menos un ingrediente
        if (Object.keys(ingredientesSeleccionados).length === 0) {
            Swal.fire('Debes seleccionar al menos un ingrediente.');
            return;
        }

        // Crear el pedido personalizado en Firebase
        await set(ref(db, 'pedido'), {
            ingredientes: ingredientesSeleccionados,
            preparar: true,
            listo: false
        });

        // Mostrar diálogo de preparación
        document.getElementById('bloqueo2').style.display = 'block';

        registrarReceta(db, 'historial','Personalizado',ingredientesSeleccionados);
        //await actualizarVolumenes(ingredientesSeleccionados);

        // Escuchar cambios en el estado del pedido
        onValue(ref(db, 'pedido/listo'), (snapshot) => {
            if (snapshot.val() === true) {
                document.getElementById('bloqueo2').style.display = 'none';
                Swal.fire('¡Tu bebida está lista!');
                set(ref(db,'pedido/listo'),false)
                set(ref(db,'pedido/preparar'),false)
            }
        });

    } catch (error) {
        console.error('Error al crear el pedido personalizado:', error);
        Swal.fire('Ocurrió un error al crear el pedido personalizado.');
    }
}




window.onload = () => {
    showSection('orden');
    //
    cargarVolumenesActuales();
    cargarVolumenesIniciales();
    cargarDensidades();

    // Asignar eventos a los botones
    document.getElementById('guardar-volumenes').addEventListener('click', guardarVolumenes);
    document.getElementById('guardar-densidades').addEventListener('click', guardarDensidades);
    document.querySelector('.recipe-button').addEventListener('click', crearPedidoPersonalizado);
    
};


module.exports = {
    apps: [{
        name:"indicadorMatico",
        script: "/home/marcuxo/ariztindicador/server/ariztindicador.js",
        env:{
            NODE_ENV: "development",
        },
        env_production:{
            NODE_ENV: "production"
        }
    }]
}
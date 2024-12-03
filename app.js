const imaps = require('imap-simple');
const express = require('express');
const bodyParser = require('body-parser');
const atob = require('atob');  // Pour décoder Base64

// Configurer l'application Express
const app = express();
app.use(bodyParser.json());

// Fonction pour récupérer et décoder les e-mails
async function getLatestOTP(email, appPassword) {
    const config = {
        imap: {
            user: email,
            password: appPassword,  // Utilisation du App Password ici
            host: 'imap.gmail.com',
            port: 993,
            tls: true,
            tlsOptions: {
                rejectUnauthorized: false // Désactive la vérification du certificat SSL
            },
            authTimeout: 10000  // Augmenter le délai d'attente à 10s
        }
    };

    return new Promise((resolve, reject) => {
        imaps.connect({ imap: config.imap }).then(connection => {
            return connection.openBox('INBOX').then(() => {
                // Critères de recherche : E-mails non lus provenant de 'Info@blsinternational.com'
                const searchCriteria = ['UNSEEN', ['FROM', 'Info@blsinternational.com']];
                const fetchOptions = {
                    bodies: ['TEXT'],  // On récupère le corps de l'e-mail
                    markSeen: true     // Marquer les e-mails comme lus
                };

                return connection.search(searchCriteria, fetchOptions).then(messages => {
                    if (messages.length === 0) {
                        reject("Aucun e-mail OTP trouvé provenant de l'expéditeur spécifié.");
                        return;
                    }

                    // On récupère le premier e-mail (le plus récent)
                    const latestMessage = messages[0];
                    let emailBody = '';

                    // Parcourir toutes les parties de l'e-mail
                    latestMessage.parts.forEach(part => {
                        if (part.body) {
                            emailBody += part.body;  // Concaténer les différentes parties du message
                        }
                    });

                    // Décoder le contenu Base64
                    const decodedBody = atob(emailBody);

                    // Log du corps de l'e-mail décodé
                    console.log('Contenu de l\'e-mail décodé :', decodedBody);

                    // Rechercher l'OTP dans le corps de l'e-mail (6 chiffres consécutifs)
                    const otpMatch = decodedBody.match(/\d{6}/);
                    if (otpMatch) {
                        console.log('OTP trouvé:', otpMatch[0]);  // Affichage de l'OTP pour debug
                        resolve(otpMatch[0]);
                    } else {
                        reject("OTP non trouvé dans l'e-mail.");
                    }
                });
            });
        }).catch(err => reject(err));
    });
}

// Endpoint pour récupérer l'OTP
app.post('/get-otp', async (req, res) => {
    const { email, appPassword } = req.body;  // Récupérer l'email et le App Password depuis la requête
    if (!email || !appPassword) {
        return res.status(400).json({ success: false, message: 'Email ou App Password manquant.' });
    }

    try {
        const otp = await getLatestOTP(email, appPassword);
        res.json({ success: true, otp });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Erreur: ' + error });
    }
});

// Démarrer l'API
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`API démarrée sur le port ${PORT}`);
});
const fs = require('fs');

async function migrate() {
    const PROJECT = 'arcator-v2';
    
    // 1. Fetch legacy profiles
    const res = await fetch(`https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents/user_profiles`);
    const data = await res.json();
    
    const docs = data.documents;
    if (!docs || docs.length === 0) {
        console.log("No profiles found.");
        return;
    }
    
    // Helper to unwrap Firestore typed objects
    const unwrap = (val) => {
        if (!val) return null;
        if (val.stringValue !== undefined) return val.stringValue;
        if (val.booleanValue !== undefined) return val.booleanValue;
        if (val.integerValue !== undefined) return parseInt(val.integerValue, 10);
        if (val.doubleValue !== undefined) return parseFloat(val.doubleValue);
        if (val.timestampValue !== undefined) return val.timestampValue;
        if (val.nullValue !== undefined) return null;
        if (val.mapValue !== undefined) {
            const obj = {};
            for (const [k, v] of Object.entries(val.mapValue.fields || {})) {
                obj[k] = unwrap(v);
            }
            return obj;
        }
        return JSON.stringify(val); // fallback
    };

    console.log(`Migrating ${docs.length} profiles...`);
    
    for (const doc of docs) {
        const uid = doc.name.split('/').pop();
        const payload = {};
        
        for (const [key, value] of Object.entries(doc.fields)) {
            payload[key] = unwrap(value);
        }
        
        const title = payload.displayName || payload.handle || 'Unknown User';
        const photoURL = payload.photoURL || '';
        
        let metaObj = { ...payload };
        delete metaObj.bio;
        const cleanBio = (payload.bio || '').toString().replace(/<!--\s*ARCATOR_META:.*?-->/g, '').trim();
        const bodyContent = `${cleanBio}\n\n<!-- ARCATOR_META:${JSON.stringify(metaObj)} -->`;
        
        // Build the new document format for `docs` collection
        const newDoc = {
            fields: {
                kind: { stringValue: 'profile' },
                authorId: { stringValue: uid },
                title: { stringValue: title.slice(0, 100) },
                body: { stringValue: bodyContent },
                photoURL: { stringValue: photoURL.startsWith('https://') ? photoURL.slice(0, 492) : '' },
                allowReplies: { booleanValue: true },
                allowPublicEdits: { booleanValue: false },
                pinned: { booleanValue: false },
                featured: { booleanValue: false },
                spoiler: { booleanValue: false },
                reactions: { mapValue: { fields: {} } },
                bodyIsHTML: { booleanValue: false },
                createdAt: { timestampValue: new Date().toISOString() },
                updatedAt: { timestampValue: new Date().toISOString() },
                lastReplyAt: { timestampValue: new Date().toISOString() },
            }
        };

        const updateRes = await fetch(`https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents/docs/u_${uid}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(newDoc)
        });
        
        if (updateRes.ok) {
            console.log(`Successfully migrated profile for UID: ${uid} (${title})`);
        } else {
            console.error(`Failed to migrate ${uid}`, await updateRes.text());
        }
    }
}

migrate().catch(console.error);

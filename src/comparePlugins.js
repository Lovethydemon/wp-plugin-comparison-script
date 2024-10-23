// src/compare-plugins.js
const fs = require('fs').promises;
const path = require('path');

function normalizePluginName(name) {
    return name.toLowerCase().trim().replace(/\s+/g, '-');
}

function parsePluginList(input) {
    const plugins = {};
    const lines = input.split('\n').filter(line => line.trim());
    
    for (let i = 1; i < lines.length; i++) {
        const line = lines[i];
        if (!line.trim()) continue;
        
        const parts = line.split('\t').map(part => part.trim());
        
        if (parts.length >= 4) {
            const name = normalizePluginName(parts[0]);
            const status = parts[1];
            const version = parts[3];
            
            if (name && status) {
                plugins[name] = {
                    status: status,
                    version: version || '',
                    isActive: status.toLowerCase() === 'active'
                };
            }
        }
    }
    
    return plugins;
}

async function comparePlugins() {
    try {
        console.log('Starting plugin comparison...');

        const [stagingContent, productionContent] = await Promise.all([
            fs.readFile(path.join(__dirname, '../data/staging-plugins.txt'), 'utf8'),
            fs.readFile(path.join(__dirname, '../data/production-plugins.txt'), 'utf8')
        ]);

        const stagingPlugins = parsePluginList(stagingContent);
        const productionPlugins = parsePluginList(productionContent);

        // 1. Active in production but missing or inactive in staging
        const productionActiveNotInStaging = Object.entries(productionPlugins)
            .filter(([name, details]) => {
                const stagingPlugin = stagingPlugins[name];
                return details.isActive && (!stagingPlugin || !stagingPlugin.isActive);
            })
            .map(([name, details]) => ({
                name,
                productionVersion: details.version,
                stagingStatus: stagingPlugins[name] ? 'inactive' : 'missing'
            }));

        // 2. Active in staging but inactive/missing in production
        const stagingActiveNotInProduction = Object.entries(stagingPlugins)
            .filter(([name, details]) => {
                const productionPlugin = productionPlugins[name];
                return details.isActive && (!productionPlugin || !productionPlugin.isActive);
            })
            .map(([name, details]) => ({
                name,
                stagingVersion: details.version,
                productionStatus: productionPlugins[name] ? 'inactive' : 'missing'
            }));

        // 3. Version mismatches for active plugins
        const versionMismatches = Object.entries(productionPlugins)
            .filter(([name, prodDetails]) => {
                const stagingPlugin = stagingPlugins[name];
                return prodDetails.isActive && 
                       stagingPlugin && 
                       stagingPlugin.isActive && 
                       prodDetails.version !== stagingPlugin.version;
            })
            .map(([name, prodDetails]) => ({
                name,
                productionVersion: prodDetails.version,
                stagingVersion: stagingPlugins[name].version
            }));

        // 4. Environment-specific plugins
        const onlyInProduction = Object.keys(productionPlugins)
            .filter(name => !stagingPlugins[name]);
            
        const onlyInStaging = Object.keys(stagingPlugins)
            .filter(name => !productionPlugins[name]);

        // Format results
        const results = [
            '\n=== WordPress Plugin Environment Comparison ===\n',
            
            '\n1. ACTIVE IN PRODUCTION BUT MISSING/INACTIVE IN STAGING:',
            productionActiveNotInStaging.length ? 
                productionActiveNotInStaging.map(({name, productionVersion, stagingStatus}) => 
                    `  - ${name} (Production v${productionVersion}) - ${stagingStatus} in staging`
                ).join('\n') :
                '  None',
            
            '\n2. ACTIVE IN STAGING BUT INACTIVE/MISSING IN PRODUCTION:',
            stagingActiveNotInProduction.length ?
                stagingActiveNotInProduction.map(({name, stagingVersion, productionStatus}) =>
                    `  - ${name} (Staging v${stagingVersion}) - ${productionStatus} in production`
                ).join('\n') :
                '  None',
            
            '\n3. VERSION MISMATCHES (ACTIVE PLUGINS):',
            versionMismatches.length ?
                versionMismatches.map(({name, productionVersion, stagingVersion}) => 
                    `  - ${name}:\n    Production: ${productionVersion}\n    Staging: ${stagingVersion}`
                ).join('\n') :
                '  None',
            
            '\n4. ENVIRONMENT-SPECIFIC PLUGINS:',
            '\nOnly in Production:',
            onlyInProduction.length ?
                onlyInProduction.map(name => 
                    `  - ${name} (${productionPlugins[name].status})`
                ).join('\n') :
                '  None',
            
            '\nOnly in Staging:',
            onlyInStaging.length ?
                onlyInStaging.map(name => 
                    `  - ${name} (${stagingPlugins[name].status})`
                ).join('\n') :
                '  None',
                
            '\n\nParsing Summary:',
            `Total Staging Plugins: ${Object.keys(stagingPlugins).length}`,
            `Total Production Plugins: ${Object.keys(productionPlugins).length}`,
            `Active in Production: ${Object.values(productionPlugins).filter(p => p.isActive).length}`,
            `Active in Staging: ${Object.values(stagingPlugins).filter(p => p.isActive).length}`
        ].join('\n');

        console.log(results);

        // Write results to file
        const resultsPath = path.join(__dirname, '../comparison-results.txt');
        await fs.writeFile(resultsPath, results, 'utf8');
        console.log('\nResults have been saved to:', resultsPath);

    } catch (error) {
        console.error('Error occurred:', error);
        process.exit(1);
    }
}

comparePlugins();
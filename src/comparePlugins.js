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
                    originalName: parts[0],
                    status: status,
                    version: version || '',
                    isActive: status.toLowerCase() === 'active'
                };
            }
        }
    }
    
    return plugins;
}

function compareVersions(version1, version2) {
    const v1Parts = version1.split('.').map(Number);
    const v2Parts = version2.split('.').map(Number);
    
    for (let i = 0; i < Math.max(v1Parts.length, v2Parts.length); i++) {
        const v1 = v1Parts[i] || 0;
        const v2 = v2Parts[i] || 0;
        if (v1 > v2) return 1;
        if (v1 < v2) return -1;
    }
    return 0;
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

        // Base comparisons (existing code)
        const productionActiveNotInStaging = Object.entries(productionPlugins)
            .filter(([name, details]) => {
                const stagingPlugin = stagingPlugins[name];
                return details.isActive && (!stagingPlugin || !stagingPlugin.isActive);
            })
            .map(([name, details]) => ({
                name,
                originalName: details.originalName,
                productionVersion: details.version,
                stagingStatus: stagingPlugins[name] ? 'inactive' : 'missing'
            }));

        const needsInstallation = productionActiveNotInStaging
            .filter(plugin => plugin.stagingStatus === 'missing')
            .sort((a, b) => a.name.localeCompare(b.name));

        const needsActivation = productionActiveNotInStaging
            .filter(plugin => plugin.stagingStatus === 'inactive')
            .sort((a, b) => a.name.localeCompare(b.name));

        // Enhanced version difference analysis
        const allPlugins = new Set([
            ...Object.keys(stagingPlugins),
            ...Object.keys(productionPlugins)
        ]);

        // 1. Version differences for active plugins in both environments
        const activeInBothVersionDiff = Array.from(allPlugins)
            .filter(name => 
                stagingPlugins[name]?.isActive && 
                productionPlugins[name]?.isActive &&
                stagingPlugins[name]?.version !== productionPlugins[name]?.version
            )
            .map(name => ({
                name,
                stagingVersion: stagingPlugins[name].version,
                productionVersion: productionPlugins[name].version,
                versionDiff: compareVersions(stagingPlugins[name].version, productionPlugins[name].version)
            }))
            .sort((a, b) => b.versionDiff - a.versionDiff);

        // 2. Version differences where staging is ahead
        const stagingAheadVersions = Array.from(allPlugins)
            .filter(name => 
                stagingPlugins[name] && 
                productionPlugins[name] &&
                compareVersions(stagingPlugins[name].version, productionPlugins[name].version) > 0
            )
            .map(name => ({
                name,
                stagingVersion: stagingPlugins[name].version,
                stagingStatus: stagingPlugins[name].status,
                productionVersion: productionPlugins[name].version,
                productionStatus: productionPlugins[name].status
            }))
            .sort((a, b) => a.name.localeCompare(b.name));

        // 3. Version differences where production is ahead
        const productionAheadVersions = Array.from(allPlugins)
            .filter(name => 
                stagingPlugins[name] && 
                productionPlugins[name] &&
                compareVersions(productionPlugins[name].version, stagingPlugins[name].version) > 0
            )
            .map(name => ({
                name,
                stagingVersion: stagingPlugins[name].version,
                stagingStatus: stagingPlugins[name].status,
                productionVersion: productionPlugins[name].version,
                productionStatus: productionPlugins[name].status
            }))
            .sort((a, b) => a.name.localeCompare(b.name));

        // 4. Critical version mismatches (active plugins with major version differences)
        const criticalVersionMismatches = Array.from(allPlugins)
            .filter(name => {
                if (!stagingPlugins[name] || !productionPlugins[name]) return false;
                const stagingParts = stagingPlugins[name].version.split('.').map(Number);
                const productionParts = productionPlugins[name].version.split('.').map(Number);
                return Math.abs(stagingParts[0] - productionParts[0]) >= 1 &&
                       (stagingPlugins[name].isActive || productionPlugins[name].isActive);
            })
            .map(name => ({
                name,
                stagingVersion: stagingPlugins[name].version,
                stagingStatus: stagingPlugins[name].status,
                productionVersion: productionPlugins[name].version,
                productionStatus: productionPlugins[name].status
            }))
            .sort((a, b) => a.name.localeCompare(b.name));

        // 5. Inactive plugins with version differences
        const inactivePluginVersionDiffs = Array.from(allPlugins)
            .filter(name => 
                stagingPlugins[name] && 
                productionPlugins[name] &&
                !stagingPlugins[name].isActive &&
                !productionPlugins[name].isActive &&
                stagingPlugins[name].version !== productionPlugins[name].version
            )
            .map(name => ({
                name,
                stagingVersion: stagingPlugins[name].version,
                productionVersion: productionPlugins[name].version
            }))
            .sort((a, b) => a.name.localeCompare(b.name));

        // Existing environment-specific plugins
        const onlyInProduction = Object.keys(productionPlugins)
            .filter(name => !stagingPlugins[name]);
            
        const onlyInStaging = Object.keys(stagingPlugins)
            .filter(name => !productionPlugins[name]);

        // Format results with new sections
        const results = [
            '\n=== WordPress Plugin Environment Comparison ===\n',
            
            '\n=== Version Analysis Sections ===\n',
            
            '\n1. ACTIVE PLUGINS VERSION DIFFERENCES (Both Environments):',
            activeInBothVersionDiff.length ?
                activeInBothVersionDiff.map(({name, stagingVersion, productionVersion, versionDiff}) =>
                    `  - ${name}:\n    Staging: v${stagingVersion}\n    Production: v${productionVersion}\n    Status: ${
                        versionDiff > 0 ? 'Staging ahead' : 'Production ahead'
                    }`
                ).join('\n') :
                '  None',
                
            '\n2. STAGING AHEAD VERSIONS:',
            stagingAheadVersions.length ?
                stagingAheadVersions.map(({name, stagingVersion, productionVersion, stagingStatus, productionStatus}) =>
                    `  - ${name}:\n    Staging: v${stagingVersion} (${stagingStatus})\n    Production: v${productionVersion} (${productionStatus})`
                ).join('\n') :
                '  None',
                
            '\n3. PRODUCTION AHEAD VERSIONS:',
            productionAheadVersions.length ?
                productionAheadVersions.map(({name, stagingVersion, productionVersion, stagingStatus, productionStatus}) =>
                    `  - ${name}:\n    Production: v${productionVersion} (${productionStatus})\n    Staging: v${stagingVersion} (${stagingStatus})`
                ).join('\n') :
                '  None',
                
            '\n4. CRITICAL VERSION MISMATCHES (Major Version Differences):',
            criticalVersionMismatches.length ?
                criticalVersionMismatches.map(({name, stagingVersion, productionVersion, stagingStatus, productionStatus}) =>
                    `  - ${name}:\n    Staging: v${stagingVersion} (${stagingStatus})\n    Production: v${productionVersion} (${productionStatus})\n    ⚠️ Major version mismatch!`
                ).join('\n') :
                '  None',
                
            '\n5. INACTIVE PLUGINS VERSION DIFFERENCES:',
            inactivePluginVersionDiffs.length ?
                inactivePluginVersionDiffs.map(({name, stagingVersion, productionVersion}) =>
                    `  - ${name}:\n    Staging: v${stagingVersion}\n    Production: v${productionVersion}`
                ).join('\n') :
                '  None',

            '\n=== Environment Status Sections ===\n',
            
            '\n1. ACTIVE IN PRODUCTION BUT MISSING/INACTIVE IN STAGING:',
            productionActiveNotInStaging.length ? 
                productionActiveNotInStaging.map(({name, productionVersion, stagingStatus}) => 
                    `  - ${name} (Production v${productionVersion}) - ${stagingStatus} in staging`
                ).join('\n') :
                '  None',
            
            '\n2. ENVIRONMENT-SPECIFIC PLUGINS:',
            '\nOnly in Production:',
            onlyInProduction.length ?
                onlyInProduction.map(name => 
                    `  - ${name} (${productionPlugins[name].status}) v${productionPlugins[name].version}`
                ).join('\n') :
                '  None',
            
            '\nOnly in Staging:',
            onlyInStaging.length ?
                onlyInStaging.map(name => 
                    `  - ${name} (${stagingPlugins[name].status}) v${stagingPlugins[name].version}`
                ).join('\n') :
                '  None',

            '\n=== Action Items ===\n',
            
            '\nPlugins Needing Installation:',
            needsInstallation.length ?
                needsInstallation.map(({name, productionVersion}) =>
                    `- ${name}\n  Production Version: ${productionVersion}`
                ).join('\n\n') :
                '  None',
            
            needsInstallation.length ?
                '\nInstallation Commands:' +
                needsInstallation.map(({originalName}) =>
                    `\nwp plugin install ${originalName}`
                ).join('') :
                '',

            '\n\nPlugins Needing Activation:',
            needsActivation.length ?
                needsActivation.map(({name, productionVersion}) =>
                    `- ${name}\n  Production Version: ${productionVersion}`
                ).join('\n\n') :
                '  None',
            
            needsActivation.length ?
                '\nActivation Commands:' +
                needsActivation.map(({originalName}) =>
                    `\nwp plugin activate ${originalName}`
                ).join('') :
                '',

            '\n=== Version Sync Recommendations ===\n',
            criticalVersionMismatches.length ?
                '⚠️ CRITICAL: Address major version mismatches first!' : '',
            productionAheadVersions.length ?
                '\nConsider updating these staging plugins to match production versions:' +
                productionAheadVersions.map(({name, productionVersion}) =>
                    `\n- Update ${name} to v${productionVersion}`
                ).join('') : '',
            
            '\n=== Summary Statistics ===\n',
            `Total Plugins:`,
            `  - Staging: ${Object.keys(stagingPlugins).length}`,
            `  - Production: ${Object.keys(productionPlugins).length}`,
            `\nActive Plugins:`,
            `  - Staging: ${Object.values(stagingPlugins).filter(p => p.isActive).length}`,
            `  - Production: ${Object.values(productionPlugins).filter(p => p.isActive).length}`,
            `\nVersion Differences:`,
            `  - Active Plugins: ${activeInBothVersionDiff.length}`,
            `  - Critical Mismatches: ${criticalVersionMismatches.length}`,
            `  - Staging Ahead: ${stagingAheadVersions.length}`,
            `  - Production Ahead: ${productionAheadVersions.length}`,
            `  - Inactive Plugins: ${inactivePluginVersionDiffs.length}`,
            `\nAction Items:`,
            `  - Needs Installation: ${needsInstallation.length}`,
            `  - Needs Activation: ${needsActivation.length}`
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
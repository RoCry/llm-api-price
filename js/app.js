function llmCompare() {
    return {
        models: [],
        selectedProvider: '',
        selectedMode: '',
        showOnlyVision: false,
        showAllModels: false,
        sortField: 'name',
        sortDirection: 'asc',
        whitelist: [],

        async init() {
            // Load config first
            const configResponse = await fetch('config.json');
            const config = await configResponse.json();
            this.whitelist = config.model_suffix_whitelist;

            // Then load model data
            const response = await fetch('model_prices_and_context_window.json');
            const data = await response.json();
            this.models = Object.entries(data)
                .filter(([key, value]) => key !== 'sample_spec')
                .map(([key, value]) => ({
                    name: key,
                    ...value,
                    provider: value.litellm_provider,
                    // Convert to price per million tokens
                    input_price_per_million: value.input_cost_per_token ? value.input_cost_per_token * 1000000 : null,
                    output_price_per_million: value.output_cost_per_token ? value.output_cost_per_token * 1000000 : null,
                    isWhitelisted: this.isModelWhitelisted(key)
                }));
        },

        isModelWhitelisted(modelName) {
            return this.whitelist.some(suffix => {
                // Get the part after the last '/' or the full string if no '/'
                const modelSuffix = modelName.split('/').pop();
                return modelSuffix === suffix;
            });
        },

        get providers() {
            return [...new Set(this.models.map(m => m.provider))].sort();
        },

        get modes() {
            return [...new Set(this.models.map(m => m.mode))].sort();
        },

        get filteredModels() {
            return this.models
                .filter(model => {
                    if (!this.showAllModels && !model.isWhitelisted) return false;
                    if (this.selectedProvider && model.provider !== this.selectedProvider) return false;
                    if (this.selectedMode && model.mode !== this.selectedMode) return false;
                    if (this.showOnlyVision && !model.supports_vision) return false;
                    return true;
                })
                .sort((a, b) => {
                    let aVal = a[this.sortField];
                    let bVal = b[this.sortField];
                    
                    // Handle null values in sorting
                    if (aVal === null) return 1;
                    if (bVal === null) return -1;
                    
                    // Compare values
                    if (aVal < bVal) return this.sortDirection === 'asc' ? -1 : 1;
                    if (aVal > bVal) return this.sortDirection === 'asc' ? 1 : -1;
                    return 0;
                });
        },

        formatCost(cost) {
            if (!cost) return 'N/A';
            return `$${cost.toFixed(2)}`;
        },

        sort(field) {
            if (this.sortField === field) {
                this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
            } else {
                this.sortField = field;
                this.sortDirection = 'asc';
            }
        },

        getSortIcon(field) {
            if (this.sortField !== field) return '↕️';
            return this.sortDirection === 'asc' ? '↑' : '↓';
        }
    }
} 
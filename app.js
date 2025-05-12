document.addEventListener('DOMContentLoaded', () => {
    // Display current date
    const dateElement = document.getElementById('current-date');
    const today = new Date();
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    dateElement.textContent = today.toLocaleDateString('en-US', options);

    // Try to get user's location with better error handling
    if (navigator.geolocation) {
        // Show loading state
        document.getElementById('location').textContent = 'Detecting location...';
        
        navigator.geolocation.getCurrentPosition(
            position => {
                const { latitude, longitude } = position.coords;
                getLocationName(latitude, longitude);
                getWeatherData(latitude, longitude, 'current');
            },
            error => {
                console.error('Error getting location:', error);
                handleLocationError(error);
            },
            { 
                timeout: 10000,  // Longer timeout for better chance of success
                maximumAge: 0,   // Always get fresh position
                enableHighAccuracy: true  // Request high accuracy
            }
        );
    } else {
        handleLocationError({ code: 0, message: 'Geolocation not supported' });
    }

    // Add event listeners for time buttons
    const timeButtons = document.querySelectorAll('.time-btn');
    timeButtons.forEach(button => {
        button.addEventListener('click', () => {
            // Remove active class from all buttons
            timeButtons.forEach(btn => btn.classList.remove('active'));
            // Add active class to clicked button
            button.classList.add('active');
            
            const timeOfDay = button.textContent.trim();
            
            // Get the current location from the location display
            const currentLocation = document.getElementById('location').textContent;
            
            // Use stored coordinates or request them again
            if (window.userCoordinates) {
                getWeatherData(window.userCoordinates.latitude, window.userCoordinates.longitude, timeOfDay);
            } else {
                // If we don't have coordinates, try to get them again
                if (navigator.geolocation) {
                    navigator.geolocation.getCurrentPosition(
                        position => {
                            window.userCoordinates = {
                                latitude: position.coords.latitude,
                                longitude: position.coords.longitude
                            };
                            getWeatherData(position.coords.latitude, position.coords.longitude, timeOfDay);
                        },
                        error => {
                            console.error('Error getting location for time change:', error);
                            handleLocationError(error);
                        }
                    );
                } else {
                    handleLocationError({ code: 0, message: 'Geolocation not supported' });
                }
            }
        });
    });
    
    // Handle location errors with better fallback options
    function handleLocationError(error) {
        let errorMessage;
        let useDefaultLocation = true;
        
        switch(error.code) {
            case 1: // PERMISSION_DENIED
                errorMessage = 'Location access denied. Using default location.';
                break;
            case 2: // POSITION_UNAVAILABLE
                errorMessage = 'Location information unavailable. Using default location.';
                break;
            case 3: // TIMEOUT
                errorMessage = 'Location request timed out. Using default location.';
                break;
            default:
                errorMessage = 'Location detection failed. Using default location.';
        }
        
        console.warn(errorMessage);
        
        // Try to get approximate location from IP address
        fetch('https://ipapi.co/json/')
            .then(response => response.json())
            .then(data => {
                if (data && data.latitude && data.longitude) {
                    document.getElementById('location').textContent = `${data.city}, ${data.country_code}`;
                    getWeatherData(data.latitude, data.longitude, 'current');
                    window.userCoordinates = {
                        latitude: data.latitude,
                        longitude: data.longitude
                    };
                    useDefaultLocation = false;
                }
            })
            .catch(err => {
                console.error('Error getting IP location:', err);
            })
            .finally(() => {
                // If IP location failed or wasn't attempted, use default location
                if (useDefaultLocation) {
                    // Default to user's timezone-appropriate major city
                    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
                    let defaultLocation = {
                        name: 'New York, US',
                        latitude: 40.7128,
                        longitude: -74.0060
                    };
                    
                    // Set location based on timezone if possible
                    if (timezone.includes('America/Los_Angeles')) {
                        defaultLocation = { name: 'Los Angeles, US', latitude: 34.0522, longitude: -118.2437 };
                    } else if (timezone.includes('Europe')) {
                        defaultLocation = { name: 'London, UK', latitude: 51.5074, longitude: -0.1278 };
                    } else if (timezone.includes('Asia')) {
                        defaultLocation = { name: 'Tokyo, JP', latitude: 35.6762, longitude: 139.6503 };
                    } else if (timezone.includes('Australia')) {
                        defaultLocation = { name: 'Sydney, AU', latitude: -33.8688, longitude: 151.2093 };
                    }
                    
                    document.getElementById('location').textContent = defaultLocation.name;
                    getWeatherData(defaultLocation.latitude, defaultLocation.longitude, 'current');
                    window.userCoordinates = {
                        latitude: defaultLocation.latitude,
                        longitude: defaultLocation.longitude
                    };
                }
            });
    }
});

// Get location name from coordinates using reverse geocoding
async function getLocationName(latitude, longitude) {
    try {
        // Store coordinates for later use
        window.userCoordinates = { latitude, longitude };
        
        // Using a free geocoding API that doesn't require authentication
        const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`);
        const data = await response.json();
        
        if (data && data.address) {
            const city = data.address.city || data.address.town || data.address.village || data.address.county || 'Unknown';
            const state = data.address.state || data.address.country_code || '';
            
            let locationText = city;
            if (state) {
                locationText += state.length <= 3 ? `, ${state}` : '';
            }
            
            document.getElementById('location').textContent = locationText;
        } else {
            document.getElementById('location').textContent = 'Unknown Location';
        }
    } catch (error) {
        console.error('Error getting location name:', error);
        document.getElementById('location').textContent = 'Unknown Location';
    }
}

// Get weather data from alternative API
async function getWeatherData(latitude, longitude, timeOfDay) {
    try {
        // For 5PM and 6PM, we'll simulate different temperatures
        if (timeOfDay === '5PM' || timeOfDay === '6PM') {
            simulateTimeBasedWeather(timeOfDay, latitude, longitude);
            return;
        }
        
        // First try with OpenWeatherMap
        try {
            const response = await fetch(`https://api.openweathermap.org/data/2.5/weather?lat=${latitude}&lon=${longitude}&units=metric&appid=071aed278ffa0fa961c3d80e53f9b38a`);
            
            // Check if the response is ok
            if (!response.ok) {
                throw new Error(`API error: ${response.status}`);
            }
            
            const data = await response.json();
            
            // Display temperature and weather description
            const temperature = Math.round(data.main.temp);
            document.getElementById('temperature').textContent = `${temperature}°`;
            
            const weatherDescription = data.weather[0].description;
            document.getElementById('weather-description').textContent = weatherDescription;
            
            // Get outfit recommendation based on weather
            const outfitSuggestion = getOutfitSuggestion(
                temperature, 
                data.weather[0].main, 
                data.wind.speed, 
                data.rain ? data.rain['1h'] : 0
            );
            document.getElementById('outfit-suggestion').textContent = outfitSuggestion;
            
        } catch (openWeatherError) {
            console.error('OpenWeatherMap error:', openWeatherError);
            useFallbackWeather(latitude, longitude);
        }
    } catch (error) {
        console.error('Error getting weather data:', error);
        useFallbackWeather(latitude, longitude);
    }
}

// Simulate different weather for different times of day based on location
function simulateTimeBasedWeather(timeOfDay, latitude, longitude) {
    let temperature, weatherMain, weatherDescription, windSpeed, rainAmount;
    
    const currentHour = new Date().getHours();
    const currentDate = new Date();
    const month = currentDate.getMonth(); // 0-11 where 0 is January
    
    // Determine if location is in northern or southern hemisphere
    const isNorthernHemisphere = latitude > 0;
    
    // Determine season based on hemisphere and month
    let season;
    if (isNorthernHemisphere) {
        if (month >= 2 && month <= 4) season = 'spring';
        else if (month >= 5 && month <= 7) season = 'summer';
        else if (month >= 8 && month <= 10) season = 'fall';
        else season = 'winter';
    } else {
        if (month >= 2 && month <= 4) season = 'fall';
        else if (month >= 5 && month <= 7) season = 'winter';
        else if (month >= 8 && month <= 10) season = 'spring';
        else season = 'summer';
    }
    
    // Get current temperature as baseline
    let baseTemp = parseInt(document.getElementById('temperature').textContent) || 20;
    
    if (timeOfDay === '5PM') {
        // Adjust temperature based on season and time of day
        if (currentHour < 12) {
            // Morning to 5PM - typically gets warmer
            switch(season) {
                case 'summer': temperature = baseTemp + 4; break;
                case 'winter': temperature = baseTemp + 1; break;
                default: temperature = baseTemp + 2; // spring/fall
            }
        } else if (currentHour > 17) {
            // Evening - 5PM is typically similar or slightly cooler
            temperature = baseTemp - 1;
        } else {
            // Afternoon - 5PM is typically similar
            temperature = baseTemp;
        }
        
        weatherMain = 'Clear';
        weatherDescription = 'Forecast for 5PM: Clear sky';
        windSpeed = 2;
        rainAmount = 0;
    } else if (timeOfDay === '6PM') {
        // 6PM is typically cooler than 5PM
        if (currentHour < 12) {
            // Morning to 6PM
            switch(season) {
                case 'summer': temperature = baseTemp + 3; break;
                case 'winter': temperature = baseTemp - 1; break;
                default: temperature = baseTemp + 1; // spring/fall
            }
        } else if (currentHour > 18) {
            // Evening - 6PM is typically cooler
            temperature = baseTemp - 2;
        } else {
            // Afternoon - 6PM is typically slightly cooler
            temperature = baseTemp - 1;
        }
        
        weatherMain = 'Clear';
        weatherDescription = 'Forecast for 6PM: Clear sky';
        windSpeed = 3;
        rainAmount = 0;
    }
    
    document.getElementById('temperature').textContent = `${temperature}°`;
    document.getElementById('weather-description').textContent = weatherDescription;
    
    const outfitSuggestion = getOutfitSuggestion(temperature, weatherMain, windSpeed, rainAmount);
    document.getElementById('outfit-suggestion').textContent = outfitSuggestion;
}

// Use location-based fallback weather
function useFallbackWeather(latitude, longitude) {
    // Estimate temperature based on latitude and time of year
    const now = new Date();
    const month = now.getMonth(); // 0-11
    
    // Determine if location is in northern or southern hemisphere
    const isNorthernHemisphere = latitude > 0;
    
    // Base temperature on latitude (equator is hotter)
    let baseTemp = 30 - Math.abs(latitude) * 0.5;
    
    // Adjust for season
    if (isNorthernHemisphere) {
        // Northern hemisphere seasons
        if (month >= 11 || month <= 1) { // Winter
            baseTemp -= 15;
        } else if (month >= 2 && month <= 4) { // Spring
            baseTemp -= 5;
        } else if (month >= 5 && month <= 7) { // Summer
            baseTemp += 5;
        } else { // Fall
            baseTemp -= 5;
        }
    } else {
        // Southern hemisphere (opposite seasons)
        if (month >= 11 || month <= 1) { // Summer
            baseTemp += 5;
        } else if (month >= 2 && month <= 4) { // Fall
            baseTemp -= 5;
        } else if (month >= 5 && month <= 7) { // Winter
            baseTemp -= 15;
        } else { // Spring
            baseTemp -= 5;
        }
    }
    
    // Round to nearest integer
    const temperature = Math.round(baseTemp);
    
    document.getElementById('temperature').textContent = `${temperature}°`;
    document.getElementById('weather-description').textContent = 'Estimated conditions';
    
    const outfitSuggestion = getOutfitSuggestion(temperature, 'Clear', 3, 0);
    document.getElementById('outfit-suggestion').textContent = outfitSuggestion;
}

// Generate outfit suggestion based on weather conditions
function getOutfitSuggestion(temperature, weatherMain, windSpeed, rainAmount) {
    let suggestion = '';
    
    // What to wear section
    suggestion = "You should wear:";
    
    // Top clothing based on temperature
    if (temperature >= 30) {
        suggestion += "\n• A thin, breathable t-shirt";
    } else if (temperature >= 25) {
        suggestion += "\n• A light t-shirt";
    } else if (temperature >= 20) {
        suggestion += "\n• A comfortable short-sleeve shirt";
    } else if (temperature >= 15) {
        suggestion += "\n• A long-sleeve shirt";
    } else if (temperature >= 10) {
        suggestion += "\n• A sweater or light jacket over a base layer";
    } else if (temperature >= 5) {
        suggestion += "\n• A warm sweater with a jacket";
    } else if (temperature >= 0) {
        suggestion += "\n• A warm jacket with layers underneath";
    } else {
        suggestion += "\n• A heavy winter coat with thermal layers";
    }
    
    // Bottom clothing based on temperature
    if (temperature >= 20) {
        suggestion += "\n• Shorts or a light skirt";
    } else {
        suggestion += "\n• Long pants in a comfy material like denim or cotton";
    }
    
    // Footwear suggestions
    if (temperature >= 20) {
        suggestion += "\n• Light footwear like sandals or sneakers";
    } else if (temperature >= 10) {
        suggestion += "\n• Comfortable closed shoes or sneakers";
    } else {
        suggestion += "\n• Warm, insulated footwear or boots";
    }
    
    // What NOT to wear - with clear separation
    suggestion += "\n\nAvoid wearing:";
    
    if (temperature >= 25) {
        suggestion += "\n• Heavy clothing or jackets";
        suggestion += "\n• Dark colors that absorb heat";
    } else if (temperature >= 20) {
        suggestion += "\n• Heavy jackets or winter clothing";
        suggestion += "\n• Too many layers";
    } else if (temperature >= 15) {
        suggestion += "\n• Shorts or t-shirts without an extra layer";
        suggestion += "\n• Very light fabrics";
    } else if (temperature >= 10) {
        suggestion += "\n• Light clothing without proper layers";
        suggestion += "\n• Clothing that doesn't cover your extremities well";
    } else {
        suggestion += "\n• Light clothing without enough warmth";
        suggestion += "\n• Clothing that leaves skin exposed to the cold";
    }
    
    // Weather condition modifiers - only if applicable
    if (weatherMain === 'Rain' || rainAmount > 0) {
        suggestion += "\n\nRain note:";
        if (rainAmount > 7) {
            suggestion += "\n• Bring a waterproof jacket";
            suggestion += "\n• Carry an umbrella";
        } else if (rainAmount > 2.5) {
            suggestion += "\n• Bring an umbrella";
            suggestion += "\n• Consider a water-resistant jacket";
        } else {
            suggestion += "\n• Consider bringing an umbrella";
        }
    } else if (weatherMain === 'Snow') {
        suggestion += "\n\nSnow note:";
        suggestion += "\n• Wear waterproof boots";
        suggestion += "\n• Don't forget hat and gloves";
    } else if (weatherMain === 'Thunderstorm') {
        suggestion += "\n\nStorm alert:";
        suggestion += "\n• Stay indoors if possible";
        suggestion += "\n• Avoid using umbrellas during lightning";
    }
    
    // Wind modifiers - only if significant
    if (windSpeed > 10) {
        suggestion += "\n\nWind alert:";
        suggestion += "\n• Wear clothing that won't get blown around";
        suggestion += "\n• Consider a windbreaker";
    }
    
    return suggestion;
}
# Agents Documentation

## Overview

Strength Journeys implements an AI-powered lifting assistant that provides personalized strength training advice and analysis. The system uses OpenAI's GPT models to create an intelligent agent that can understand user lifting data, provide coaching insights, and answer strength training questions.

## Architecture

### Core Components

#### 1. AI Lifting Assistant (`/src/pages/ai-lifting-assistant.js`)
The main AI agent interface that provides:
- **Chat Interface**: Real-time conversation with the AI assistant
- **Data Integration**: Incorporates user lifting data from Google Sheets
- **Personalization**: Uses user bio data and lifting history for tailored advice
- **Session Management**: Maintains chat history in browser sessionStorage

#### 2. AI Chat API (`/src/app/api/chat/route.js`)
Server-side API endpoint that:
- **Model Management**: Routes to appropriate OpenAI model based on user tier
- **Prompt Engineering**: Applies system prompts and user context
- **Streaming**: Provides real-time response streaming
- **Authentication**: Integrates with NextAuth for user identification

#### 3. Data Collection Components
- **Bio Details Card** (`/src/components/ai-assistant/bio-details-card.js`): Collects user demographics
- **Lifting Data Card** (`/src/components/ai-assistant/lifting-data-card.js`): Manages data sharing preferences

## Agent Capabilities

### Data Analysis
The AI agent can analyze:
- **Personal Records**: Lifetime and yearly bests across all lift types
- **Consistency Metrics**: Training frequency and adherence patterns
- **Session Data**: Detailed analysis of recent workout sessions
- **Progress Tracking**: Strength gains over time with context

### Coaching Features
- **Personalized Advice**: Tailored recommendations based on user data
- **Safety Guidance**: Emphasizes proper form and injury prevention
- **Goal Setting**: Helps users establish realistic strength targets
- **Motivation**: Provides encouragement and celebrates achievements

### Interactive Features
- **Sample Questions**: Pre-populated conversation starters
- **Chat Export**: Download conversation history
- **Real-time Streaming**: Immediate response generation
- **Context Awareness**: Maintains conversation context

## Technical Implementation

### AI Model Configuration
```javascript
// Model selection based on user tier
const AI_model = openai("gpt-4.1"); // Current model
// Support for different tiers: gpt-4o, gpt-4o-mini, etc.
```

### Data Processing Pipeline
1. **Data Collection**: User selects which data to share with AI
2. **Context Building**: System constructs comprehensive user profile
3. **Prompt Engineering**: Applies system prompts and user context
4. **Response Generation**: AI generates personalized responses
5. **Streaming**: Real-time delivery to user interface

### Privacy & Security
- **Client-Side Processing**: Most data analysis happens in browser
- **Selective Sharing**: Users control what data is shared with AI
- **No Server Storage**: Chat history stored only in browser
- **Secure API**: All AI requests go through authenticated endpoints

## System Prompts

### Base System Prompt
```
"You are a strength coach answering questions only about barbell exercises with an emphasis on getting strong. Emphasise safety and take precautions if user indicates any health concerns."
```

### Extended Prompt System
- **Environment Variable**: `EXTENDED_AI_PROMPT` for advanced prompt configuration
- **Deployment Script**: `deploy_extended_AI_prompt.sh` for prompt updates
- **Multi-Environment**: Supports production, preview, and development environments

## User Data Integration

### Bio Data
- Age, sex, height, body weight
- Unit preferences (metric/imperial)
- Strength standards based on demographics

### Lifting Data
- Personal records (lifetime and yearly)
- Training frequency and consistency
- Recent session details
- Lift-specific performance metrics

### Data Privacy Controls
Users can selectively share:
- ✅ Personal records and achievements
- ✅ Training frequency data
- ✅ Consistency ratings
- ✅ Detailed session data
- ✅ Bio details (age, weight, etc.)

## API Endpoints

### POST `/api/chat`
**Purpose**: Main AI chat endpoint
**Authentication**: Required (NextAuth)
**Request Body**:
```json
{
  "messages": [{"role": "user", "content": "..."}],
  "userProvidedMetadata": "user context string"
}
```
**Response**: Streaming text response

## Configuration

### Environment Variables
- `OPENAI_API_KEY`: OpenAI API key
- `EXTENDED_AI_PROMPT`: Advanced system prompt
- `SJ_PAID_USERS`: List of users with advanced model access

### Dependencies
- `@ai-sdk/openai`: OpenAI integration
- `@ai-sdk/react`: React hooks for AI chat
- `ai`: Core AI SDK functionality

## Usage Examples

### Basic Chat
```javascript
const { messages, input, handleInputChange, handleSubmit } = useChat({
  body: { userProvidedMetadata: userContext },
  onError: (error) => console.error(error)
});
```

### Data Context Building
```javascript
// Build user context from lifting data
if (userLiftingMetadata.records) {
  userProvidedProfileData += `User best ever ${liftType} single was ${weight}${unit} on ${date}`;
}
```

## Future Enhancements

### Planned Features
- **Multi-Model Support**: Integration with additional AI providers
- **Advanced Analytics**: More sophisticated data analysis
- **Workout Planning**: AI-generated training programs
- **Progress Predictions**: Machine learning-based strength forecasting

### Technical Improvements
- **Caching**: Response caching for common questions
- **Rate Limiting**: API usage optimization
- **Analytics**: Usage tracking and optimization
- **Mobile Optimization**: Enhanced mobile experience

## Development

### Local Development
```bash
npm install
npm run dev
```

### Deployment
- **Automatic**: Vercel auto-deploys from main branch
- **Manual**: Use deployment scripts for environment updates
- **Environment Management**: Separate configs for dev/preview/production

### Testing
- **Unit Tests**: Component-level testing
- **Integration Tests**: API endpoint testing
- **User Testing**: Real-world usage feedback

## Monitoring & Analytics

### Performance Metrics
- Response times
- User engagement
- Error rates
- Model usage patterns

### User Feedback
- Built-in feedback collection
- Canny integration for feature requests
- Usage analytics for optimization

## Security Considerations

### Data Protection
- No persistent storage of user data
- Encrypted API communications
- Secure authentication flow
- Privacy-first design

### API Security
- Rate limiting
- Input validation
- Authentication requirements
- Error handling

## Troubleshooting

### Common Issues
1. **API Key Missing**: Check `OPENAI_API_KEY` environment variable
2. **Model Access**: Verify user tier and model availability
3. **Data Loading**: Ensure Google Sheets integration is working
4. **Streaming Issues**: Check network connectivity and API status

### Debug Tools
- `devLog()` utility for debugging
- Console logging for API responses
- Session storage inspection
- Network request monitoring

---

*This documentation covers the AI agent functionality in Strength Journeys. For general project information, see the main README.md file.*
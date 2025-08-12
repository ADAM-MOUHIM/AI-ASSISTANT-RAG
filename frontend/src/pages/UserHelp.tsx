import { HelpCircle, MessageCircle, Mail, ExternalLink } from 'lucide-react';

export function UserHelp() {
  const faqItems = [
    {
      question: "How do I start a new conversation?",
      answer: "Click the 'New Chat' button in the chat sidebar to start a new conversation."
    },
    {
      question: "Can I delete my conversations?",
      answer: "Yes, you can delete conversations by clicking the delete button next to each conversation in the sidebar."
    },
    {
      question: "How do I update my profile?",
      answer: "Go to the Profile section and click the Edit button to update your information."
    },
    {
      question: "Is my data secure?",
      answer: "Yes, we take security seriously and use encryption to protect your data."
    }
  ];

  return (
    <div className="max-w-2xl mx-auto p-6">
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-medium text-gray-900 flex items-center space-x-2">
            <HelpCircle size={20} />
            <span>Help & Support</span>
          </h2>
        </div>

        <div className="px-6 py-4">
          {/* Quick Actions */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
            <button className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors text-left">
              <div className="flex items-center space-x-3">
                <MessageCircle className="text-blue-500" size={24} />
                <div>
                  <h3 className="font-medium text-gray-900">Live Chat</h3>
                  <p className="text-sm text-gray-500">Chat with our support team</p>
                </div>
              </div>
            </button>

            <button className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors text-left">
              <div className="flex items-center space-x-3">
                <Mail className="text-green-500" size={24} />
                <div>
                  <h3 className="font-medium text-gray-900">Email Support</h3>
                  <p className="text-sm text-gray-500">Send us an email</p>
                </div>
              </div>
            </button>
          </div>

          {/* FAQ Section */}
          <div>
            <h3 className="text-lg font-medium text-gray-900 mb-4">Frequently Asked Questions</h3>
            <div className="space-y-4">
              {faqItems.map((item, index) => (
                <details key={index} className="group">
                  <summary className="flex justify-between items-center cursor-pointer p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                    <span className="font-medium text-gray-900">{item.question}</span>
                    <span className="text-gray-500 group-open:rotate-180 transition-transform">
                      ▼
                    </span>
                  </summary>
                  <div className="mt-2 p-4 text-gray-700 bg-white border-l-4 border-blue-500 rounded-b-md">
                    {item.answer}
                  </div>
                </details>
              ))}
            </div>
          </div>
        </div>

        <div className="px-6 py-4 border-t border-gray-200">
          <a
            href="https://support.example.com"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center text-sm text-blue-600 hover:underline"
          >
            <ExternalLink size={16} className="mr-1" />
            Visit full Help Center
          </a>
        </div>
      </div>
    </div>
  );
}

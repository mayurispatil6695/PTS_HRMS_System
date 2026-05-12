import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { FileText, Save, Plus, Trash2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { toast } from '../ui/use-toast';
import { ref, push, set } from 'firebase/database';
import { database } from '../../firebase';
import { useAuth } from '../../hooks/useAuth';

interface SalaryField {
  id: string;
  label: string;
  type: 'earning' | 'deduction';
  isDefault: boolean;
  isPercentage: boolean;
  value: number;
}

const SalaryTemplateCreator = () => {
  const { user } = useAuth();
  const [templateName, setTemplateName] = useState('');
  const [loading, setLoading] = useState(false);
  const [fields, setFields] = useState<SalaryField[]>([
    { id: '1', label: 'Basic Salary', type: 'earning', isDefault: true, isPercentage: false, value: 0 },
    { id: '2', label: 'HRA', type: 'earning', isDefault: true, isPercentage: true, value: 30 },
    { id: '3', label: 'Medical Allowance', type: 'earning', isDefault: true, isPercentage: false, value: 2000 },
    { id: '4', label: 'PF Deduction', type: 'deduction', isDefault: true, isPercentage: true, value: 12 },
    { id: '5', label: 'Professional Tax', type: 'deduction', isDefault: true, isPercentage: false, value: 200 }
  ]);

  const addField = () => {
    const newField: SalaryField = {
      id: Date.now().toString(),
      label: '',
      type: 'earning',
      isDefault: false,
      isPercentage: false,
      value: 0
    };
    setFields([...fields, newField]);
  };

  const updateField = (id: string, updates: Partial<SalaryField>) => {
    setFields(fields.map(field => 
      field.id === id ? { ...field, ...updates } : field
    ));
  };

  const removeField = (id: string) => {
    const fieldToRemove = fields.find(f => f.id === id);
    // Prevent removing default fields
    if (fieldToRemove?.isDefault) {
      toast({
        title: "Error",
        description: "Default fields cannot be removed",
        variant: "destructive"
      });
      return;
    }
    setFields(fields.filter(field => field.id !== id));
  };

  const saveTemplate = async () => {
    if (!templateName.trim()) {
      toast({
        title: "Error",
        description: "Please enter a template name",
        variant: "destructive"
      });
      return;
    }

    if (!user) {
      toast({
        title: "Error",
        description: "You must be logged in",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);
    try {
      const template = {
        name: templateName,
        fields: fields,
        createdAt: new Date().toISOString(),
        createdBy: user.id,
        createdByName: user.name || 'Admin',
      };

      const templatesRef = ref(database, 'salaryTemplates');
      const newTemplateRef = push(templatesRef);
      await set(newTemplateRef, template);

      toast({
        title: "Template Saved",
        description: `Salary template "${templateName}" has been created successfully`
      });

      // Reset form
      setTemplateName('');
      // Optionally reset fields to defaults? Leave as is or reset to original defaults
    } catch (error) {
      console.error('Error saving template:', error);
      toast({
        title: "Error",
        description: "Failed to save template. Please try again.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Create Salary Template
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <Label htmlFor="templateName">Template Name</Label>
            <Input
              id="templateName"
              value={templateName}
              onChange={(e) => setTemplateName(e.target.value)}
              placeholder="e.g., Standard Salary Template"
              disabled={loading}
            />
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">Salary Components</h3>
              <Button onClick={addField} size="sm" disabled={loading}>
                <Plus className="h-3 w-3 mr-1" />
                Add Field
              </Button>
            </div>

            <div className="space-y-3">
              {fields.map((field) => (
                <div key={field.id} className="flex items-center gap-3 p-3 border rounded-lg">
                  <div className="flex-1">
                    <Input
                      value={field.label}
                      onChange={(e) => updateField(field.id, { label: e.target.value })}
                      placeholder="Field Label"
                      disabled={field.isDefault || loading}
                    />
                  </div>
                  <select
                    value={field.type}
                    onChange={(e) => updateField(field.id, { type: e.target.value as 'earning' | 'deduction' })}
                    className="px-3 py-2 border rounded-md"
                    disabled={field.isDefault || loading}
                  >
                    <option value="earning">Earning</option>
                    <option value="deduction">Deduction</option>
                  </select>
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      value={field.value}
                      onChange={(e) => updateField(field.id, { value: parseFloat(e.target.value) || 0 })}
                      placeholder="Value"
                      className="w-20"
                      disabled={loading}
                    />
                    <label className="flex items-center gap-1 text-sm">
                      <input
                        type="checkbox"
                        checked={field.isPercentage}
                        onChange={(e) => updateField(field.id, { isPercentage: e.target.checked })}
                        disabled={loading}
                      />
                      %
                    </label>
                  </div>
                  {!field.isDefault && (
                    <Button
                      onClick={() => removeField(field.id)}
                      size="sm"
                      variant="outline"
                      disabled={loading}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </div>

          <Button onClick={saveTemplate} className="w-full" disabled={loading}>
            <Save className="h-3 w-3 mr-1" />
            {loading ? 'Saving...' : 'Save Template'}
          </Button>
        </CardContent>
      </Card>
    </motion.div>
  );
};

export default SalaryTemplateCreator;